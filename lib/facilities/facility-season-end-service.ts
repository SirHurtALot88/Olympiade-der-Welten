import { createHash, randomUUID } from "node:crypto";

import type { FacilityEventRecord, GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { getFacilityEfficiency, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { degradeFacilityCondition } from "@/lib/facilities/facility-condition";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { istJeSpieltagSaison, ungebuchterAnteil } from "@/lib/finance/finanzen-je-spieltag";
import { ohneAltesArenaGebaeude } from "@/lib/arena/arena-gebaeude";
import {
  buildRows,
  getRawFacilityLevel,
  resolveFacilityIncomeFaktor,
  roundValue,
  type FacilitySeasonEndFinanceFacilityRow,
} from "@/lib/facilities/gebaeude-saisonbetraege";

export {
  berechneGebaeudeSaisonbetraege,
  resolveFacilityIncomeFaktor,
  type FacilitySeasonEndFinanceFacilityRow,
} from "@/lib/facilities/gebaeude-saisonbetraege";


export type FacilitySeasonEndFinancePreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  team: { teamId: string; shortCode: string; name: string } | null;
  cashBeforeFacilities: number | null;
  facilityUpkeepTotal: number;
  facilityIncomeTotal: number;
  fanShopIncome: number;
  arenaIncome: number;
  /** Beliebtheitsfaktor des Teams (1.0 = Liga-Durchschnitt), mit dem die Arena-Basis skaliert wurde. */
  arenaPopularityFactor: number;
  netFacilityResult: number;
  cashAfterFacilities: number | null;
  disabledFacilities: FacilitySeasonEndFinanceFacilityRow[];
  rows: FacilitySeasonEndFinanceFacilityRow[];
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    seasonId: string;
    saveStatus: string;
  };
};

export type FacilitySeasonEndFinanceApplyResult = Omit<FacilitySeasonEndFinancePreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  facilityEventIds: string[];
};


function buildConfirmToken(input: {
  saveId: string;
  teamId: string;
  seasonId: string;
  cashBeforeFacilities: number;
  facilityUpkeepTotal: number;
  facilityIncomeTotal: number;
  disabledFacilityIds: string[];
}) {
  return createHash("sha256")
    .update(
      [
        input.saveId,
        input.teamId,
        input.seasonId,
        input.cashBeforeFacilities,
        input.facilityUpkeepTotal,
        input.facilityIncomeTotal,
        input.disabledFacilityIds.join(","),
      ].join(":"),
    )
    .digest("hex");
}

/**
 * Anteil der Saisonbetraege, den der Saisonabschluss noch bucht. Alter Modus: 1 (alles). Modus "je Spieltag": der Teil
 * der Spieltage, der nicht je Spieltag gebucht wurde (im Normalfall 0 — dann bucht der Abschluss kein Geld mehr, nur noch
 * Verschleiss und Zahlmarke).
 */
export function gebaeudeRestAnteil(gameState: GameState, teamId: string): number {
  return istJeSpieltagSaison(gameState) ? ungebuchterAnteil(gameState, teamId) : 1;
}

export function previewFacilitySeasonEndFinance(
  save: PersistedSaveGame,
  teamId: string,
): FacilitySeasonEndFinancePreview {
  const gameState = save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const teamFacilities = ohneAltesArenaGebaeude(gameState, getTeamFacilityState(gameState, teamId));
  const cashBeforeFacilities = team?.cash ?? null;
  // Beliebtheit skaliert die Arena-Einnahme (real cash). Läuft für Menschen- UND
  // KI-Teams; fehlt der Team-/Kontext, liefert die Funktion neutral 1.0.
  const arenaPopularityFactor = computeTeamBeliebtheitFromGameState(gameState, teamId).value;
  const incomeFaktor = resolveFacilityIncomeFaktor(gameState, teamId);
  const rows = buildRows(teamFacilities, cashBeforeFacilities, gameState.season.id, arenaPopularityFactor, incomeFaktor);
  // Gebäude werden NICHT mehr durch Nichtzahlung deaktiviert (Unterhalt ist Pflicht) — daher immer leer.
  // Feld bleibt für API-/Anzeige-Kompatibilität erhalten. (Verfall-bedingtes Brechen läuft separat im Apply.)
  const disabledFacilities: FacilitySeasonEndFinanceFacilityRow[] = [];
  const paidUpkeepTotal = roundValue(rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.upkeep, 0));
  const facilityIncomeTotal = roundValue(rows.reduce((sum, row) => sum + row.income, 0));
  const fanShopIncome = rows.find((row) => row.facilityId === "fan_shop")?.income ?? 0;
  const arenaIncome = rows.find((row) => row.facilityId === "arena_upgrade")?.income ?? 0;
  const netFacilityResult = roundValue(facilityIncomeTotal - paidUpkeepTotal);
  const cashAfterFacilities =
    cashBeforeFacilities == null ? null : roundValue(cashBeforeFacilities + facilityIncomeTotal - paidUpkeepTotal);
  const blockingReasons: string[] = [];
  if (save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  const warnings = [
    disabledFacilities.length > 0 ? "facility_upkeep_unpaid" : null,
    fanShopIncome <= 0 ? "fan_shop_income_missing" : null,
    arenaIncome <= 0 ? "arena_income_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const confirmToken =
    blockingReasons.length === 0 && team && cashBeforeFacilities != null
      ? buildConfirmToken({
          saveId: save.saveId,
          teamId,
          seasonId: gameState.season.id,
          cashBeforeFacilities,
          facilityUpkeepTotal: paidUpkeepTotal,
          facilityIncomeTotal,
          disabledFacilityIds: disabledFacilities.map((row) => row.facilityId),
        })
      : null;

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    team: team ? { teamId: team.teamId, shortCode: team.shortCode, name: team.name } : null,
    cashBeforeFacilities,
    facilityUpkeepTotal: paidUpkeepTotal,
    facilityIncomeTotal,
    fanShopIncome,
    arenaIncome,
    arenaPopularityFactor,
    netFacilityResult,
    cashAfterFacilities,
    disabledFacilities,
    rows,
    warnings,
    blockingReasons,
    saveContext: {
      saveId: save.saveId,
      seasonId: gameState.season.id,
      saveStatus: save.status,
    },
  };
}

/**
 * Season-scoped idempotency guard: true once `applyFacilitySeasonEndFinance` has already
 * recorded a facility event for this team in this season (upkeep paid/unpaid or income
 * collected). Mirrors the ad-hoc check scripts already used (see
 * scripts/season-transition-s1-s2-run.ts) so the real season-completion pipeline and the
 * standalone scripts agree on what "already applied" means and never double-credit income
 * or double-charge upkeep on retried/dry runs.
 */
export function hasFacilitySeasonEndFinanceApplied(gameState: GameState, seasonId: string, teamId: string): boolean {
  return (gameState.seasonState.facilityEvents ?? []).some(
    (event) =>
      event.seasonId === seasonId &&
      event.teamId === teamId &&
      (event.source === "facility_upkeep_paid" ||
        event.source === "facility_upkeep_unpaid" ||
        event.source === "facility_income_collected"),
  );
}

export function applyFacilitySeasonEndFinance(
  save: PersistedSaveGame,
  teamId: string,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): FacilitySeasonEndFinanceApplyResult {
  const preview = previewFacilitySeasonEndFinance(save, teamId);
  // Audit R2/A6: interne Idempotenz-Sperre (Defense-in-Depth). Die Season-Completion-Pipeline prüft
  // hasFacilitySeasonEndFinanceApplied bereits vor dem Aufruf, aber Direktaufrufer (Skripte, Long-Run-
  // Sandbox, künftiger Code) täten das evtl. nicht — ohne diese Sperre würde ein zweiter Apply in
  // derselben Saison das Fan-Shop-Einkommen erneut gutschreiben und den Upkeep erneut abbuchen. Der
  // confirmToken allein schützt nicht, da er zustandslos/deterministisch aus dem Preview stammt.
  if (hasFacilitySeasonEndFinanceApplied(save.gameState, save.gameState.season.id, teamId)) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventIds: [],
      blockingReasons: [...preview.blockingReasons, "facility_season_end_already_applied"],
    };
  }
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      facilityEventIds: [],
      blockingReasons: [...preview.blockingReasons, confirmToken ? "facility_season_end_preview_stale" : "confirm_token_required"],
    };
  }
  const teamFacilities = getTeamFacilityState(save.gameState, teamId);
  // Modus "je Spieltag": Einnahme und Unterhalt sind schon je Spieltag gebucht — hier nur der ungebuchte Rest (im
  // Normalfall 0). Verschleiss, Zahlmarke und die Ereigniszeilen bleiben, damit die Saisonende-Kette unveraendert greift.
  const restAnteil = gebaeudeRestAnteil(save.gameState, teamId);
  const eventIds: string[] = [];
  const events: FacilityEventRecord[] = [];
  const nextFacilities: TeamFacilityCollection = {
    facilities: { ...teamFacilities.facilities },
  };
  for (const row of preview.rows) {
    // Nur bezahlte Unterhalts-Zeilen erzeugen ein Event; Unterhalt ist Pflicht, es gibt kein "unbezahlt" mehr.
    if (row.status !== "paid") {
      continue;
    }
    const eventId = `facility-event-${randomUUID()}`;
    eventIds.push(eventId);
    const previous = nextFacilities.facilities[row.facilityId];
    const previousConditionPct = getFacilityEfficiency(teamFacilities, row.facilityId).conditionPct;
    // Saatwort aus Saison, Team und Gebaeude: derselbe Spielstand ergibt zweimal denselben
    // Verschleiss, zwei Gebaeude desselben Teams aber verschiedenen.
    const nextConditionPct = degradeFacilityCondition(
      previousConditionPct,
      true,
      `${save.gameState.season.id}:${teamId}:${row.facilityId}`,
    );
    nextFacilities.facilities[row.facilityId] = {
      ...previous,
      // Deaktivierung nur noch durch Verfall (condition <= 0), nie durch Nichtzahlung.
      enabled: nextConditionPct > 0,
      lastPaidSeasonId: save.gameState.season.id,
      conditionPct: nextConditionPct,
      disabledReason: nextConditionPct <= 0 ? "facility_condition_broken" : undefined,
    };
    events.push({
      eventId,
      seasonId: save.gameState.season.id,
      teamId,
      facilityId: row.facilityId,
      previousLevel: row.level,
      nextLevel: row.level,
      cost: row.status === "paid" ? roundValue(row.upkeep * restAnteil) : 0,
      timestamp: new Date().toISOString(),
      source: row.status === "paid" ? "facility_upkeep_paid" : "facility_upkeep_unpaid",
      previousConditionPct,
      nextConditionPct,
    });
  }
  const incomeEventId = preview.facilityIncomeTotal > 0 ? `facility-event-${randomUUID()}` : null;
  if (incomeEventId) {
    eventIds.push(incomeEventId);
    events.push({
      eventId: incomeEventId,
      seasonId: save.gameState.season.id,
      teamId,
      facilityId: "fan_shop",
      previousLevel: getRawFacilityLevel(teamFacilities, "fan_shop"),
      nextLevel: getRawFacilityLevel(teamFacilities, "fan_shop"),
      cost: -roundValue(preview.facilityIncomeTotal * restAnteil),
      timestamp: new Date().toISOString(),
      source: "facility_income_collected",
    });
  }
  const nextGameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) =>
      team.teamId === teamId
        ? {
            ...team,
            cash:
              restAnteil >= 1
                ? (preview.cashAfterFacilities ?? team.cash)
                : roundValue(team.cash + preview.netFacilityResult * restAnteil),
          }
        : team,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      teamFacilities: {
        ...(save.gameState.seasonState.teamFacilities ?? {}),
        [teamId]: nextFacilities,
      },
      facilityEvents: [...events, ...(save.gameState.seasonState.facilityEvents ?? [])],
    },
  };

  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return {
    ...previewFacilitySeasonEndFinance({ ...save, gameState: nextGameState }, teamId),
    dryRun: false,
    applied: true,
    facilityEventIds: eventIds,
    blockingReasons: [],
  };
}
