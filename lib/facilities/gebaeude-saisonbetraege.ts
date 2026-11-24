// Reiner Rechenteil der Gebaeude-Saisonbetraege (ohne Persistenz, ohne node:-Module), damit auch Client-Code wie
// die Sponsor-Topf-Eingaben (Budget-Gespraech im Buero) ihn importieren kann. Der Saisonende-Dienst
// (`facility-season-end-service.ts`) re-exportiert alles von hier; das Verhalten ist unveraendert.
import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG,
  getFacilityLevelDefinition,
  type FacilityId,
} from "@/lib/facilities/facility-catalog";
import {
  calculateFacilitySeasonUpkeep,
  FACILITY_INCOME_FAKTOR_JE_LIGA,
  getFacilityEfficiency,
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";
import { arenaUnterhaltDerSaison, ohneAltesArenaGebaeude } from "@/lib/arena/arena-gebaeude";

export type FacilitySeasonEndFinanceFacilityRow = {
  facilityId: FacilityId;
  label: string;
  level: number;
  enabled: boolean;
  upkeep: number;
  income: number;
  status: "not_built" | "enabled" | "paid" | "already_paid" | "will_disable_unpaid" | "disabled";
  warning: string | null;
};

export function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getRawFacilityLevel(teamFacilities: TeamFacilityCollection, facilityId: FacilityId) {
  const raw = teamFacilities.facilities[facilityId]?.level ?? 0;
  return Math.max(0, Math.min(5, Math.round(raw)));
}

/**
 * LIGA-SPLIT PR4: der Gebäudeeinnahme-Rabatt fuer DIESES Team — nur `FACILITY_INCOME_FAKTOR_JE_LIGA.liga2`,
 * wenn der Split aktiv ist UND das Team Liga 2 zugeordnet ist (heute nie, `isLeagueSplitActive`
 * liefert immer `false`). Sonst 1, bit-identisch zu vor diesem PR.
 */
export function resolveFacilityIncomeFaktor(gameState: GameState, teamId: string): number {
  if (!isLeagueSplitActive(gameState)) return 1;
  return getLeagueOf(gameState, teamId) === "liga2" ? FACILITY_INCOME_FAKTOR_JE_LIGA.liga2 : 1;
}

export function buildRows(
  teamFacilities: TeamFacilityCollection,
  cashBefore: number | null,
  seasonId: string,
  arenaPopularityFactor: number,
  // LIGA-SPLIT PR4 (Chris: „Der Abschlag gilt auch für Gebäudeeinnahmen"): Default 1, bit-identisch
  // zu vor diesem PR — siehe `resolveFacilityIncomeFaktor` fuer den Liga-Split-gegateten Aufrufer.
  incomeFaktor = 1,
) {
  const enabledRows = FACILITY_CATALOG.map((facility) => {
    const state = teamFacilities.facilities[facility.facilityId];
    const rawLevel = getRawFacilityLevel(teamFacilities, facility.facilityId);
    const effectLevel = getFacilityLevel(teamFacilities, facility.facilityId);
    const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
    const definition = getFacilityLevelDefinition(facility.facilityId, effectLevel);
    const enabled = Boolean(state?.enabled) && rawLevel > 0;
    // Arena-Einnahme = Basis × Beliebtheit(Team). Alle anderen Gebäude flach.
    const popularityFactor = facility.facilityId === "arena_upgrade" ? arenaPopularityFactor : 1;
    return {
      facilityId: facility.facilityId,
      label: facility.label,
      level: rawLevel,
      enabled,
      upkeep: calculateFacilitySeasonUpkeep(facility.facilityId, teamFacilities),
      // Liga-2-Rabatt wirkt NACH der Effekt-/Effizienzrechnung (Stufe, Zustand, Beliebtheit bleiben
      // fuer beide Ligen identisch) — reines Kuerzen des Endergebnisses, wie von Chris gefordert.
      income: roundValue((((definition?.seasonIncome ?? 0) * efficiencyPct * popularityFactor) / 100) * incomeFaktor),
      status: rawLevel <= 0 ? "not_built" : enabled ? "enabled" : "disabled",
      warning: !enabled && rawLevel > 0 ? state?.disabledReason ?? "facility_disabled" : null,
    } satisfies FacilitySeasonEndFinanceFacilityRow;
  });
  const facilityIncomeTotal = roundValue(enabledRows.reduce((sum, row) => sum + row.income, 0));
  let cashAvailableForUpkeep = cashBefore == null ? null : roundValue(cashBefore + facilityIncomeTotal);

  return enabledRows.map((row) => {
    if (!row.enabled || row.upkeep <= 0) {
      return row;
    }
    if (teamFacilities.facilities[row.facilityId]?.lastPaidSeasonId === seasonId) {
      return {
        ...row,
        status: "already_paid",
        warning: "facility_upkeep_already_paid",
      } satisfies FacilitySeasonEndFinanceFacilityRow;
    }
    // Unterhalt ist PFLICHT und kann nicht umgangen werden: immer abbuchen, auch wenn das Cash dadurch
    // ins Minus zieht. Ein negatives Saison-Ende wird anschließend vom Zahlungsunfähigkeits-Backstop
    // (applyInsolvencyBackstop, season-completion) in einen echten Notkredit umgewandelt — Gebäude werden
    // NICHT mehr durch Nichtzahlung deaktiviert.
    if (cashAvailableForUpkeep != null) {
      cashAvailableForUpkeep = roundValue(cashAvailableForUpkeep - row.upkeep);
    }
    return {
      ...row,
      status: "paid",
    } satisfies FacilitySeasonEndFinanceFacilityRow;
  });
}

/**
 * SAISONBETRAEGE der Gebaeude eines Teams (Einnahme, bezahlter Unterhalt) nach demselben Rechenweg wie die
 * Saisonende-Vorschau — fuer die Buchung je Spieltag (`lib/finance/finanzen-je-spieltag-buchung.ts`, Anteil 1/N).
 * Ein Gebaeude, dessen Unterhalt diese Saison schon abgebucht ist (`lastPaidSeasonId`), zaehlt nicht noch einmal.
 */
export function berechneGebaeudeSaisonbetraege(gameState: GameState, teamId: string): { income: number; upkeep: number } {
  // ARENA (22.11.): mit der Arena-Regel zahlt "Arena Upgrade" nichts und kostet nichts; stattdessen der Unterhalt der Ausbau-Schritte.
  const teamFacilities = ohneAltesArenaGebaeude(gameState, getTeamFacilityState(gameState, teamId));
  const rows = buildRows(
    teamFacilities,
    null,
    gameState.season.id,
    computeTeamBeliebtheitFromGameState(gameState, teamId).value,
    resolveFacilityIncomeFaktor(gameState, teamId),
  );
  return {
    income: roundValue(rows.reduce((sum, row) => sum + row.income, 0)),
    upkeep: roundValue(rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.upkeep, 0) + arenaUnterhaltDerSaison(gameState, teamId)),
  };
}

