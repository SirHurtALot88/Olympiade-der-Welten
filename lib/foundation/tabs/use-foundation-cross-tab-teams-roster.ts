import { useCallback, useMemo } from "react";

import type { TeamDetailDrawerData, TeamDetailDrawerHistoryRow } from "@/lib/foundation/team-detail-drawer-types";
import type { TeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { resolvePlayerDisciplinePoints } from "@/lib/foundation/discipline-points-source";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";
import {
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";
import { resolveLiveSeasonStandRowsForTeamHistory } from "@/lib/foundation/team-detail-history-rows";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { getPlayerPortraitModel } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import {
  buildSharedRankMap,
  getPlayerDisplayMarketValueDelta,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  roundViewNumber,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import type { TeamsAreaRank } from "@/lib/foundation/tabs/teams-view-derivations";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { leseSaisonHistorie } from "@/lib/persistence/foundation-season-history-projection";
import { resolveTeamSellProfit } from "@/lib/foundation/team-transfer-history-helpers";
import {
  computeTeamSeasonAverageMatchdayFatigue,
  countTeamSeasonInjuries,
} from "@/lib/foundation/team-history-health-metrics";
import { buildTeamPlayerDemandMap, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildPlayerDevelopmentInsight, getPotentialBand } from "@/lib/progression/player-potential-service";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";
import { buildTeamRelationshipCards } from "@/lib/rivalries/team-relationship-dynamics";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { isFoundationTeamManagementLocked } from "@/lib/foundation/foundation-admin-dev-flags";
import {
  buildTeamProfileSessionKey,
  getCachedTeamProfileData,
  setCachedTeamProfileData,
} from "@/lib/foundation/team-profile-session-cache";
import {
  buildTeamHistoryDisciplineValuesFromRecord,
  buildTeamHistoryDisciplineValuesFromSnapshot,
  resolveSeasonDisciplineAreaTotal,
  type SeasonDisciplineAreaId,
} from "@/lib/season/season-discipline-area-groups";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { extractSeasonNumber, getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";

/**
 * Pro-Achse aufgeschlüsselte Season-PPs eines Roster-Spielers (POW/SPE/MEN/SOC),
 * inklusive der einzelnen Disziplin-PPs je Achse. Speist die ausklappbare
 * Disziplin-PPs-Ansicht der Verträge/Kader-Rostertabelle. Die Disziplin-Punkte
 * kommen direkt aus `seasonPointsLedger.playerSummariesByPlayerId.<id>.pointsByDiscipline`
 * (echte Ligapunkte je Disziplin) — nicht neu erfunden, nur nach Achse gruppiert.
 */
export type RosterAxisDisciplinePps = {
  axis: SeasonDisciplineAreaId;
  label: string;
  axisPps: number | null;
  /** `playerCount` = Kadergröße der Disziplin (wie viele Spieler pro Team antreten). */
  disciplines: Array<{ id: string; name: string; pps: number; playerCount: number | null }>;
};

export type FoundationRosterTableRow = {
  entry: RosterEntry;
  player: Player;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsRank?: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  disciplinePpsByAxis: RosterAxisDisciplinePps[];
  saleBreakdown: ReturnType<typeof buildTransfermarktSaleFactorBreakdown>;
  /** "Neuer Look" CA/PO-Sterne (Tier-3 Rosterkarten) — fog-korrekt über den Scouting-Bridge-Snapshot. */
  known: boolean;
  caStars: number | null;
  poStarRange: { min: number; max: number } | null;
  caScore: number | null;
  poScoreRange: { min: number; max: number } | null;
};

/**
 * CA/PO-Sterne + exakte Zahlen für eine Rosterkarte ("Neuer Look") — fog-korrekt:
 * bekannte (eigene) Teams bekommen vollen Scouting-Level, unbekannte (nicht
 * steuerbare) Teams bleiben auf Scouting-Level 0 (ungescoutet). Nutzt denselben
 * Sterne-Bridge-Snapshot wie die Scouting-Watchlist (`buildPlayerStarScoutingSnapshot`)
 * statt eine eigene Fog-Logik zu erfinden.
 */
function buildRosterCaPoStarFields(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
  known: boolean;
  currentRating: number | null;
}): Pick<FoundationRosterTableRow, "known" | "caStars" | "poStarRange" | "caScore" | "poScoreRange"> {
  const scoutingLevel = input.known ? 5 : 0;
  const snapshot = buildPlayerStarScoutingSnapshot({
    gameState: input.gameState,
    player: input.player,
    saveId: input.saveId,
    scoutingLevel,
  });
  const insight = buildPlayerDevelopmentInsight({
    gameState: input.gameState,
    player: input.player,
    currentRating: input.currentRating,
    scoutingLevel,
  });
  return {
    known: input.known,
    caStars: snapshot.revealedCurrentStars.overall,
    poStarRange:
      snapshot.revealedPotentialStars.overallMin != null && snapshot.revealedPotentialStars.overallMax != null
        ? { min: snapshot.revealedPotentialStars.overallMin, max: snapshot.revealedPotentialStars.overallMax }
        : null,
    caScore: insight.currentRating ?? null,
    poScoreRange: insight.potentialRangeDisplay ?? null,
  };
}

type FoundationPlayerRatingSnapshot = {
  ovrNormalized?: number | null;
  mvs?: number | null;
  ppsSeason?: number | null;
  ppPow?: number | null;
  ppSpe?: number | null;
  ppMen?: number | null;
  ppSoc?: number | null;
  // Die Achsen-Ränge liegen in `PlayerRatingContractRow` längst neben den Achsenwerten
  // (`buildSharedRankMap` je Achse) — sie standen hier nur nicht im Ausschnitt, den dieser
  // Hook liest. Ohne sie kann die Kaderkarte die PPs zwar zeigen, aber nicht einordnen.
  ppPowRank?: number | null;
  ppSpeRank?: number | null;
  ppMenRank?: number | null;
  ppSocRank?: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsSeasonRank?: number | null;
};

type CurrentMatchdayDisciplineSchedule = {
  discipline1?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
  discipline2?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
} | null;

type SeasonPointsLedger = {
  teamSummariesByTeamId: Map<
    string,
    {
      totalPoints?: number | null;
      pointsByArea: {
        power?: number | null;
        speed?: number | null;
        mental?: number | null;
        social?: number | null;
      };
    }
  >;
  playerSummariesByPlayerId?: Map<
    string,
    {
      pointsByDiscipline?: Record<string, number> | null;
      pointsByArea?: Record<string, number | null | undefined> | null;
    }
  > | null;
} | null;

/**
 * Entscheidet, WOHER die Disziplin-PPs einer Rosterzeile kommen.
 *
 * Die Regel selbst steht in `lib/foundation/discipline-points-source.ts` — sie
 * gilt wortgleich auch für die Spielerliste und die Saisonstand-Aufklappung.
 * Hier bleibt nur der Name stehen, unter dem der Teams-Tab sie aufruft.
 */
export const resolveRosterDisciplinePointsSource = resolvePlayerDisciplinePoints;

/**
 * Reihenfolge + Achse↔Kategorie-Zuordnung für die Disziplin-PPs-Aufschlüsselung.
 * `category` ist die `DisciplineCategory` (power/speed/mental/social) am
 * `Discipline`-Objekt, `axis` die kurze POW/SPE/MEN/SOC-Kennung (Ton-Tokens).
 */
const ROSTER_PPS_AXES: Array<{ axis: SeasonDisciplineAreaId; label: string; category: string }> = [
  { axis: "pow", label: "POW", category: "power" },
  { axis: "spe", label: "SPE", category: "speed" },
  { axis: "men", label: "MEN", category: "mental" },
  { axis: "soc", label: "SOC", category: "social" },
];

/**
 * Gruppiert die echten Disziplin-PPs eines Spielers (aus dem Season-Ledger) nach
 * den vier Achsen POW/SPE/MEN/SOC. Der Achsen-Gesamtwert stammt aus dem bereits
 * berechneten `playerRating` (ppPow/…) — die Disziplin-Einzelwerte aus
 * `pointsByDiscipline`. Es wird nichts neu erfunden: fehlt ein Ledger-Eintrag,
 * steht die Disziplin mit 0 PPs (der Katalog kommt aus `gameState.disciplines`).
 */
export function buildRosterDisciplinePpsByAxis(input: {
  disciplines: GameState["disciplines"];
  pointsByDiscipline: Record<string, number> | null | undefined;
  pointsByArea: Record<string, number | null | undefined> | null | undefined;
  axisTotals: Record<SeasonDisciplineAreaId, number | null>;
}): RosterAxisDisciplinePps[] {
  // Katalog-Reihenfolge (`originalOrder`): TDM · Mini DM · Gewichtheben · Hockey · Breaking.
  // Vorher stand `displayOrder` vorn — das ist die SPIELPLAN-Reihenfolge (TDM hat dort 13 und
  // rutschte damit ans Ende der POW-Liste). In einer Nachschlage-Liste soll die Ordnung aber
  // dieselbe und wiedererkennbare sein, egal wie der Spielplan der Saison gerade liegt.
  const orderedDisciplines = [...input.disciplines].sort(
    (left, right) =>
      (left.originalOrder ?? left.displayOrder ?? 0) - (right.originalOrder ?? right.displayOrder ?? 0),
  );
  return ROSTER_PPS_AXES.map(({ axis, label, category }) => {
    // Achsen-Gesamtwert bevorzugt aus derselben Ledger-Quelle wie die Disziplinen
    // (damit das aufgeklappte Panel in sich stimmig ist: Achsentotal = Summe der
    // gezeigten Disziplinen), sonst Fallback auf den Ratings-Achsenwert.
    const ledgerAreaTotal = input.pointsByArea?.[category];
    const axisPps =
      typeof ledgerAreaTotal === "number" && Number.isFinite(ledgerAreaTotal)
        ? roundViewNumber(ledgerAreaTotal, 1)
        : input.axisTotals[axis] ?? null;
    return {
      axis,
      label,
      axisPps,
      disciplines: orderedDisciplines
        .filter((discipline) => discipline.category === category)
        .map((discipline) => {
          const raw = input.pointsByDiscipline?.[discipline.id];
          return {
            id: discipline.id,
            name: discipline.name,
            pps: Number.isFinite(raw) ? roundViewNumber(raw as number, 1) : 0,
            // Kadergröße der Disziplin — steht in der Liste als "(6)" hinter dem Namen und
            // sagt, wie viele Spieler pro Team hier antreten. Fehlt der Katalogwert, bleibt
            // die Klammer weg statt eine Zahl zu erfinden.
            playerCount:
              typeof discipline.playerCount === "number" && Number.isFinite(discipline.playerCount)
                ? discipline.playerCount
                : null,
          };
        }),
    };
  });
}

function buildTeamProfileContentSignature(input: {
  saveId: string;
  gameState: GameState;
  teamId: string;
  playerRatingsById: Map<string, FoundationPlayerRatingSnapshot>;
}) {
  const rosterSize = (input.gameState.rosters ?? []).filter((entry) => entry.teamId === input.teamId).length;
  const seasonSnapshotCount = input.gameState.seasonState.seasonSnapshots?.length ?? 0;
  const transferCount = (input.gameState.transferHistory ?? []).filter(
    (entry) => entry.toTeamId === input.teamId || entry.fromTeamId === input.teamId,
  ).length;
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  return [
    input.saveId,
    input.gameState.season.id,
    team?.cash ?? "cash",
    rosterSize,
    seasonSnapshotCount,
    transferCount,
    input.playerRatingsById.size,
  ].join("|");
}

const EMPTY_SELECTED_ROSTER_TABLE_ROWS: FoundationRosterTableRow[] = [];

export function shouldBuildFoundationSelectedRosterTableRows(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  shouldBuildMarketView: boolean;
}): boolean {
  return input.shouldBuildTeamsView || input.shouldBuildHomeV2Overview || input.shouldBuildMarketView;
}

export function shouldBuildFoundationTeamProfileData(teamProfileTeamId: string | null): boolean {
  return Boolean(teamProfileTeamId);
}

/**
 * Summe der PPs über alle Zeilen der Team-Historie — also GENAU das, was in der PPs-Spalte
 * darüber steht, live inklusive.
 *
 * Bewusst aus den fertigen Zeilen und nicht aus der ligaweiten Rangliste: die Summenzeile steht
 * unmittelbar unter den Saisons und muss sich nachrechnen lassen. Die Rangliste dient nur der
 * EINORDNUNG (welcher Platz), sie kann bei der laufenden Saison auf eine andere Quelle
 * zurückfallen als die Zeile — dann wäre eine Summe von dort um Zehntel danebengelaufen und die
 * Tabelle widerspräche sich selbst.
 */
function summiereHistorienPps(zeilen: TeamDetailDrawerHistoryRow[]): number | null {
  const werte = zeilen.map((zeile) => zeile.pps).filter((wert): wert is number => typeof wert === "number" && Number.isFinite(wert));
  if (werte.length === 0) {
    return null;
  }
  return roundViewNumber(werte.reduce((summe, wert) => summe + wert, 0), 1);
}

export function useFoundationCrossTabTeamsRoster(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  shouldBuildMarketView: boolean;
  teamProfileTeamId: string | null;
  canonicalSeasonLabel: string;
  gameState: GameState;
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  playerRatingsById: Map<string, FoundationPlayerRatingSnapshot>;
  seasonStandRows: TeamManagementSnapshotRow[];
  seasonStandRowsSeasonId: string;
  activeSaveId?: string | null;
  currentAreaRanksByTeamId: Map<string, TeamsAreaRank>;
  seasonPointsLedger: SeasonPointsLedger;
  /**
   * Serverseitig gerechneter Spieler-Slice — Quelle der Disziplin-PPs (das
   * Warum steht an `resolveRosterDisciplinePointsSource`). Bewusst nur die drei
   * Felder, die hier gebraucht werden, damit der Hook nicht am ganzen
   * Slice-Vertrag hängt.
   */
  playerDirectorySlice: {
    payload: unknown;
    error: string | null;
    /** Disziplin-ID → in dieser Saison geholte PPs, je Spieler (Server-Ledger). */
    disciplinePointsByPlayerId: Record<string, Record<string, number>>;
  };
  teamObjectiveOverview: TeamObjectiveOverview;
  currentMatchdayDisciplineSchedule: CurrentMatchdayDisciplineSchedule;
  /** Steuerbare Teams des aktiven Owners — bestimmt `known` für CA/PO-Sterne (Tier-3 Rosterkarten). */
  manageableTeamIds?: string[] | null;
}) {
  const shouldBuildSelectedRosterTableRows = shouldBuildFoundationSelectedRosterTableRows({
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    shouldBuildMarketView: input.shouldBuildMarketView,
  });

  const liveSeasonStandRows = useMemo(
    () =>
      resolveLiveSeasonStandRowsForTeamHistory({
        gameState: input.gameState,
        seasonStandRows: input.seasonStandRows,
        seasonStandRowsSeasonId: input.seasonStandRowsSeasonId,
        activeSaveId: input.activeSaveId,
      }),
    [
      input.activeSaveId,
      input.gameState,
      input.seasonStandRows,
      input.seasonStandRowsSeasonId,
    ],
  );

  /**
   * GEWÜNSCHT: „es wäre cool ne all time spalte mit den PPs All Time zu haben + rank" — auf
   * Nachfrage als Summenzeile unter den Saisons der Team-Historie.
   *
   * Die PPs einer Saison sind die Disziplinpunkte des Teams (`disciplinePoints` im Schnappschuss,
   * `ppsTotal` in der laufenden Saison). All Time ist ihre Summe über alle Saisons inklusive der
   * laufenden — und der Rang die Position des Teams in genau dieser Summe.
   *
   * LIGAWEIT, nicht je Team gerechnet: für einen Rang braucht es alle Teams. Gelesen wird über
   * `leseSaisonHistorie`, also die volle Fassung auf dem Server und die mitgefahrene Kurzfassung im
   * Browser — sonst stünde hier dieselbe Falle wie bei der Spielerhistorie, wo die Anfangsladung
   * die Schnappschüsse streicht und die Zahl still auf null fiele.
   */
  const allTimePpsByTeamId = useMemo(() => {
    const summen = new Map<string, number>();
    const addiere = (teamId: string | null | undefined, wert: number | null | undefined) => {
      if (!teamId || typeof wert !== "number" || !Number.isFinite(wert)) {
        return;
      }
      summen.set(teamId, (summen.get(teamId) ?? 0) + wert);
    };

    for (const eintrag of leseSaisonHistorie(input.gameState)) {
      // Die laufende Saison steckt bereits in liveSeasonStandRows — ein archivierter Eintrag mit
      // derselben Season-ID (Teil-Snapshot) wuerde sie sonst doppelt zaehlen.
      if (eintrag.seasonId === input.gameState.season.id) {
        continue;
      }
      for (const team of eintrag.teams) {
        addiere(team.teamId, team.disciplinePoints);
      }
    }
    for (const zeile of liveSeasonStandRows) {
      addiere(zeile.teamId, zeile.ppsTotal);
    }

    const rangfolge = [...summen.entries()].sort((links, rechts) => rechts[1] - links[1]);
    const raenge = new Map<string, number>();
    rangfolge.forEach(([teamId], index) => {
      // Gleichstand teilt sich den Rang — zwei Teams mit derselben Summe stehen beide auf #7.
      const vorher = index > 0 ? rangfolge[index - 1] : null;
      const rang = vorher != null && vorher[1] === summen.get(teamId) ? raenge.get(vorher[0])! : index + 1;
      raenge.set(teamId, rang);
    });

    return { summen, raenge, teamCount: rangfolge.length };
  }, [input.gameState, liveSeasonStandRows]);

  const selectedRosterTableRows = useMemo(() => {
    if (!shouldBuildSelectedRosterTableRows) {
      return EMPTY_SELECTED_ROSTER_TABLE_ROWS;
    }

    const saveId = input.activeSaveId ?? "default";
    return [...input.rosterPlayers]
      .map(({ entry, player }) => {
        const playerRating = input.playerRatingsById.get(player.id) ?? null;
        const known = !isFoundationTeamManagementLocked(entry.teamId, input.manageableTeamIds);
        const caPoStarFields = buildRosterCaPoStarFields({
          gameState: input.gameState,
          player,
          saveId,
          known,
          // CA = peak-gewichtete Current Ability aus den Corestats (#113), NICHT
          // die Season-PPS (Liga-Leistung, bei MD1 überall 0/null → sonst kollabiert
          // die CA für alle Spieler auf denselben Fallback-Wert → alle 2★).
          currentRating: computeCurrentAbilityScore(player.coreStats),
        });
        return {
          entry,
          player,
          playerOvr: playerRating?.ovrNormalized ?? null,
          playerMvs: playerRating?.mvs ?? null,
          playerPps: playerRating?.ppsSeason ?? null,
          ovrRank: playerRating?.ovrRank ?? null,
          mvsRank: playerRating?.mvsRank ?? null,
          ppsRank: playerRating?.ppsSeasonRank ?? null,
          ppPow: playerRating?.ppPow ?? null,
          ppSpe: playerRating?.ppSpe ?? null,
          ppMen: playerRating?.ppMen ?? null,
          ppSoc: playerRating?.ppSoc ?? null,
          disciplinePpsByAxis: (() => {
            const ledgerSummary =
              input.seasonPointsLedger?.playerSummariesByPlayerId?.get(player.id) ?? null;
            // Quellenwahl liegt in `resolveRosterDisciplinePointsSource` —
            // dort steht auch das Warum (kompakter Client-Payload).
            const pointsByDiscipline = resolveRosterDisciplinePointsSource({
              playerId: player.id,
              playerDirectorySlice: input.playerDirectorySlice,
              ledgerPointsByDiscipline: ledgerSummary?.pointsByDiscipline,
            });
            return buildRosterDisciplinePpsByAxis({
              disciplines: input.gameState.disciplines,
              pointsByDiscipline,
              // Achsen-Gesamtwert bleibt am Ledger: ist der leer, fällt
              // `buildRosterDisciplinePpsByAxis` auf `ppPow`/`ppSpe`… zurück —
              // und die stammen aus demselben Server-Ledger wie die Slice-Werte.
              pointsByArea: ledgerSummary?.pointsByArea ?? null,
              axisTotals: {
                pow: playerRating?.ppPow ?? null,
                spe: playerRating?.ppSpe ?? null,
                men: playerRating?.ppMen ?? null,
                soc: playerRating?.ppSoc ?? null,
              },
            });
          })(),
          saleBreakdown: buildTransfermarktSaleFactorBreakdown(input.gameState, player, entry),
          ...caPoStarFields,
        };
      })
      .sort((left, right) =>
        compareTeamRosterPlayersByOvrOrMarketValue({
          left: {
            ovr: left.playerOvr,
            marketValue: getRosterEntryDisplayMarketValue(left.entry, left.player),
            mvs: left.playerMvs,
            name: left.player.name,
          },
          right: {
            ovr: right.playerOvr,
            marketValue: getRosterEntryDisplayMarketValue(right.entry, right.player),
            mvs: right.playerMvs,
            name: right.player.name,
          },
        }),
      );
  }, [
    input.activeSaveId,
    input.gameState,
    input.manageableTeamIds,
    // Die Disziplin-PPs-Quelle gehört ZWINGEND in die Deps: sie wird im Memo
    // gelesen (`disciplinePpsByAxis`), trifft aber erst nach der ersten
    // Zeilenberechnung ein — ohne Dep blieben die Zeilen auf dem Stand vor dem
    // Slice-Eintreffen (also mit leeren PPs) eingefroren.
    input.playerDirectorySlice.disciplinePointsByPlayerId,
    input.playerDirectorySlice.error,
    input.playerDirectorySlice.payload,
    input.playerRatingsById,
    input.rosterPlayers,
    input.seasonPointsLedger,
    shouldBuildSelectedRosterTableRows,
  ]);

  const buildTeamDetailDrawerData = useCallback(
    (
      resolvedTeamId: string | null,
      scope: "full" | "history-summary" = "full",
      areaRanksByTeamId: Map<string, TeamsAreaRank> = input.currentAreaRanksByTeamId,
    ): TeamDetailDrawerData | null => {
      if (!resolvedTeamId) {
        return null;
      }

      const team = input.gameState.teams.find((entry) => entry.teamId === resolvedTeamId) ?? null;
      if (!team) {
        return null;
      }

      const saveId = input.activeSaveId ?? "default";
      const contentSignature = buildTeamProfileContentSignature({
        saveId,
        gameState: input.gameState,
        teamId: resolvedTeamId,
        playerRatingsById: input.playerRatingsById,
      });
      const cacheKey = buildTeamProfileSessionKey(saveId, input.gameState.season.id, resolvedTeamId);
      const liveSeasonOverviewRow =
        liveSeasonStandRows.find((entry) => entry.teamId === team.teamId) ?? null;
      const currentAreaRanks = areaRanksByTeamId.get(team.teamId) ?? null;
      const currentTeamPointsSummary = input.seasonPointsLedger?.teamSummariesByTeamId.get(team.teamId) ?? null;
      const currentSeasonTransfers = input.gameState.transferHistory.filter(
        (entry) => entry.seasonId === input.gameState.season.id,
      );
      const currentTopBuy =
        [...currentSeasonTransfers]
          .filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId)
          .sort((left, right) => (right.fee ?? 0) - (left.fee ?? 0))[0] ?? null;
      const currentTopSell =
        [...currentSeasonTransfers]
          .filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId)
          .sort((left, right) => (right.fee ?? 0) - (left.fee ?? 0))[0] ?? null;
      /**
       * ERSATZ FUER DEN BROWSER. Die Anfangsladung streicht `seasonSnapshots` (siehe
       * `foundation-initial-compact-state`), also stand hier im Browser eine leere Liste und jede
       * vergangene Saison fiel auf eine Platzhalterzeile mit `rank: null` zurueck — das war das
       * „—" in der Saison-Verlauf-Karte. Die mitgefahrene Kurzfassung traegt genau die Felder der
       * Historienzeile.
       *
       * Was sie NICHT traegt, bleibt null: Disziplinwerte und Durchschnittsmuedigkeit brauchen
       * Spieltags- und Disziplinergebnisse der alten Saison, und die faehrt niemand mit. Sie waren
       * im Browser aber ohnehin schon leer — hier wird nichts schlechter, nur Rang, Punkte, Cash,
       * Gehalt, Marktwert und GuV werden endlich gefuellt.
       */
      const projizierteHistorie = (input.gameState.seasonState.seasonSnapshots ?? []).length > 0
        ? []
        : (input.gameState.seasonState.foundationSeasonHistory ?? []).map((eintrag) => {
            const teamEintrag = eintrag.teams.find((entry) => entry.teamId === team.teamId) ?? null;
            if (!teamEintrag) {
              return null;
            }
            const topBuy =
              [...eintrag.transfers]
                .filter((entry) => entry.type === "buy" && entry.toTeamId === team.teamId)
                .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
            const topSell =
              [...eintrag.transfers]
                .filter((entry) => entry.type === "sell" && entry.fromTeamId === team.teamId)
                .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
            return {
              seasonId: eintrag.seasonId,
              seasonName: eintrag.seasonName ?? getCanonicalSeasonLabel({ seasonId: eintrag.seasonId }),
              isLive: false,
              rank: teamEintrag.rank,
              points: teamEintrag.points,
              pps: teamEintrag.disciplinePoints,
              ppPow: teamEintrag.disciplinePointsByArea.pow,
              ppSpe: teamEintrag.disciplinePointsByArea.spe,
              ppMen: teamEintrag.disciplinePointsByArea.men,
              ppSoc: teamEintrag.disciplinePointsByArea.soc,
              /**
               * Die Kurzfassung traegt die Rohwerte des Schnappschusses, die Auswahl trifft die
               * Ansicht — deshalb darf hier nichts vorab zusammengefasst werden.
               */
              // Cash wie im Snapshot-Pfad unten: `cashEntry` zuerst (siehe die Begruendung dort),
              // dann der eingefrorene Saisonabschluss, die ueberschriebenen Felder nur als
              // Rueckfall.
              cash:
                teamEintrag.cashEntry ??
                teamEintrag.cashSeasonEnd ??
                teamEintrag.cashEnd ??
                teamEintrag.cashTotal,
              salaryTotal:
                teamEintrag.salarySeasonEnd ?? teamEintrag.salaryTotalEnd ?? teamEintrag.salaryEnd,
              marketValue:
                teamEintrag.marketValueSeasonEnd ??
                teamEintrag.marketValueTotalEnd ??
                teamEintrag.marketValueEnd,
              guv: teamEintrag.guv,
              topBuyPlayer: topBuy?.playerName ?? null,
              topBuyPlayerId: topBuy?.playerId ?? null,
              topBuyAmount: topBuy?.amount ?? null,
              topSellPlayer: topSell?.playerName ?? null,
              topSellPlayerId: topSell?.playerId ?? null,
              topSellAmount: topSell?.amount ?? null,
              topSellProfit:
                topSell?.playerId != null
                  ? resolveTeamSellProfit(input.gameState, team.teamId, topSell.playerId, topSell.amount ?? 0)
                  : null,
              /**
               * Verletzungen gehen OHNE Schnappschuss: `seasonState.injuryEvents` faehrt in der
               * Anfangsladung mit (am Live-Spielstand 2498 Eintraege) und traegt die Saison-ID
               * selbst. Also wird die Spalte hier genauso gezaehlt wie im Schnappschuss-Pfad.
               */
              injuriesCount: (() => {
                const anzahl = countTeamSeasonInjuries(input.gameState, team.teamId, eintrag.seasonId);
                return anzahl > 0 ? anzahl : null;
              })(),
              /**
               * Bleibt leer, und das ist keine Nachlaessigkeit: die Durchschnittsmuedigkeit
               * braucht die Spieltagsergebnisse der alten Saison, und die faehrt niemand mit —
               * sie sind der Grund, warum die Schnappschuesse ueberhaupt gestrichen werden.
               */
              averageFatigue: null,
              disciplineValues: {},
            } satisfies TeamDetailDrawerHistoryRow;
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const archivedHistoryRows = [...(input.gameState.seasonState.seasonSnapshots ?? [])]
        .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }))
        .map((snapshot) => {
          const teamSnapshot =
            resolveSeasonSnapshotTeamRecords(snapshot).find((entry) => entry.teamId === team.teamId) ?? null;
          if (!teamSnapshot) {
            return null;
          }

          const topBuy =
            [...(snapshot.transferSnapshots ?? [])]
              .filter((entry) => entry.type === "buy" && entry.toTeamId === team.teamId)
              .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
          const topSell =
            [...(snapshot.transferSnapshots ?? [])]
              .filter((entry) => entry.type === "sell" && entry.fromTeamId === team.teamId)
              .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
          const areaPoints = teamSnapshot.disciplinePointsByArea ?? {
            pow: null,
            spe: null,
            men: null,
            soc: null,
          };
          const disciplineValues = buildTeamHistoryDisciplineValuesFromSnapshot(snapshot, team.teamId);
          const injuriesCount = countTeamSeasonInjuries(input.gameState, team.teamId, snapshot.seasonId);
          const averageFatigue = computeTeamSeasonAverageMatchdayFatigue({
            gameState: input.gameState,
            teamId: team.teamId,
            seasonId: snapshot.seasonId,
            snapshot,
          });

          return {
            seasonId: snapshot.seasonId,
            seasonName: snapshot.seasonName,
            isLive: false,
            rank: teamSnapshot.rank ?? null,
            points: teamSnapshot.points ?? null,
            pps: teamSnapshot.disciplinePoints ?? null,
            ppPow: resolveSeasonDisciplineAreaTotal(disciplineValues, "pow", areaPoints.pow),
            ppSpe: resolveSeasonDisciplineAreaTotal(disciplineValues, "spe", areaPoints.spe),
            ppMen: resolveSeasonDisciplineAreaTotal(disciplineValues, "men", areaPoints.men),
            ppSoc: resolveSeasonDisciplineAreaTotal(disciplineValues, "soc", areaPoints.soc),
            /**
             * CASH IST DER EINTRITTSSTAND, GEHALT UND MW SIND DER SAISONABSCHLUSS — und das ist
             * Absicht, keine vergessene Zeile.
             *
             * GEMELDET VON CHRIS an der Historie von L-K: „sie hatten so viel cash und sind nun
             * negativ? […] der cash wert ist vermutlich vom ende der season und nicht vor den
             * verkäufen gewesen?" — genau so war es. `cashEnd` ist der Stand NACH der
             * Verkaufsphase am Saisonende. L-K stand dort mit 137,4 in der Zeile, hatte VOR dem
             * Ausverkauf aber nur 9,4: fünf Verkäufe über 127,96 hatten das Konto eine Sekunde
             * lang aufgeblasen. Die Zeile zeigte damit einen Kontostand, den das Team nie zum
             * Spielen hatte, und das Delta zur Live-Zeile las sich wie ein Absturz um 168.
             *
             * ENTSCHIEDEN: `cashEntry` — der Stand zu Beginn der FOLGE-Saison, nach Käufen und
             * Kaderfüllung. Das ist das Geld, mit dem das Team wirklich losgespielt hat, und es
             * ist dieselbe Wahl, die die Ewige Tabelle (`all-time-table.ts`) schon trifft. Beide
             * Ansichten weisen ab hier dieselbe Zahl aus.
             *
             * WARUM GEHALT UND MW NICHT MITWANDERN: sie tragen die Frage „wie stark war der Kader
             * am Saisonende", und die beantwortet der eingefrorene `*SeasonEnd`-Block (Ende
             * `player_development`, nach Trainings-Apply, vor dem ersten Verkauf). Cash
             * beantwortet die Frage „womit ging das Team in die nächste Saison". Die Spalten
             * stehen also bewusst auf zwei Zeitpunkten — der Spaltenkopf sagt es an.
             *
             * RÜCKFALLKETTE, in dieser Reihenfolge: ohne Eintritts-Patch (letzte archivierte
             * Saison vor der nächsten Vorbereitung, Altsaves) der eingefrorene Saisonabschluss,
             * erst danach die überschriebenen Altfelder.
             */
            cash:
              teamSnapshot.cashEntry ??
              teamSnapshot.cashSeasonEnd ??
              teamSnapshot.cashEnd ??
              teamSnapshot.cashTotal ??
              null,
            salaryTotal:
              teamSnapshot.salarySeasonEnd ?? teamSnapshot.salaryTotalEnd ?? teamSnapshot.salaryEnd ?? null,
            marketValue:
              teamSnapshot.marketValueSeasonEnd ??
              teamSnapshot.marketValueTotalEnd ??
              teamSnapshot.marketValueEnd ??
              null,
            guv: teamSnapshot.guv ?? null,
            topBuyPlayer: topBuy?.playerName ?? null,
            topBuyPlayerId: topBuy?.playerId ?? null,
            topBuyAmount: topBuy?.amount ?? null,
            topSellPlayer: topSell?.playerName ?? null,
            topSellPlayerId: topSell?.playerId ?? null,
            topSellAmount: topSell?.amount ?? null,
            topSellProfit:
              topSell?.playerId != null
                ? resolveTeamSellProfit(input.gameState, team.teamId, topSell.playerId, topSell.amount)
                : null,
            injuriesCount: injuriesCount > 0 ? injuriesCount : null,
            averageFatigue,
            disciplineValues,
          } satisfies TeamDetailDrawerHistoryRow;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const liveDisciplineValues = buildTeamHistoryDisciplineValuesFromRecord(liveSeasonOverviewRow?.disciplineValues);
      const currentInjuriesCount = countTeamSeasonInjuries(input.gameState, team.teamId, input.gameState.season.id);
      const currentAverageFatigue = computeTeamSeasonAverageMatchdayFatigue({
        gameState: input.gameState,
        teamId: team.teamId,
        seasonId: input.gameState.season.id,
      });
      const currentHistoryRow: TeamDetailDrawerHistoryRow = {
        seasonId: input.gameState.season.id,
        seasonName: input.gameState.season.name,
        isLive: true,
        rank: liveSeasonOverviewRow?.rank ?? null,
        points: liveSeasonOverviewRow?.points ?? null,
        pps:
          liveSeasonOverviewRow?.ppsTotal ??
          (currentTeamPointsSummary?.totalPoints != null
            ? roundViewNumber(currentTeamPointsSummary.totalPoints, 1)
            : null),
        ppPow: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "pow",
          liveSeasonOverviewRow?.ppsPow ?? currentTeamPointsSummary?.pointsByArea.power ?? null,
        ),
        ppSpe: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "spe",
          liveSeasonOverviewRow?.ppsSpe ?? currentTeamPointsSummary?.pointsByArea.speed ?? null,
        ),
        ppMen: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "men",
          liveSeasonOverviewRow?.ppsMen ?? currentTeamPointsSummary?.pointsByArea.mental ?? null,
        ),
        ppSoc: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "soc",
          liveSeasonOverviewRow?.ppsSoc ?? currentTeamPointsSummary?.pointsByArea.social ?? null,
        ),
        cash: liveSeasonOverviewRow?.cash ?? null,
        salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
        marketValue: liveSeasonOverviewRow?.marketValueTotal ?? null,
        guv: liveSeasonOverviewRow?.guv ?? null,
        topBuyPlayer: currentTopBuy?.playerName ?? null,
        topBuyPlayerId: currentTopBuy?.playerId ?? null,
        topBuyAmount: currentTopBuy?.fee ?? null,
        topSellPlayer: currentTopSell?.playerName ?? null,
        topSellPlayerId: currentTopSell?.playerId ?? null,
        topSellAmount: currentTopSell?.fee ?? null,
        topSellProfit:
          currentTopSell?.playerId != null
            ? resolveTeamSellProfit(input.gameState, team.teamId, currentTopSell.playerId, currentTopSell.fee)
            : null,
        injuriesCount: currentInjuriesCount > 0 ? currentInjuriesCount : null,
        averageFatigue: currentAverageFatigue,
        disciplineValues: liveDisciplineValues,
      };
      // Lückenlose Team-Historie: jede Season von Season 1 (bzw. der frühesten
      // Snapshot-Season) bis zur aktuellen Season erhält eine Zeile. Seasons ohne
      // Snapshot bekommen eine Platzhalter-Zeile (Rang/Punkte/MW/Cash = null),
      // damit die Historie-Tabelle die komplette Timeline zeigt.
      const buildTeamHistoryPlaceholderRow = (seasonId: string): TeamDetailDrawerHistoryRow => ({
        seasonId,
        seasonName: getCanonicalSeasonLabel({ seasonId, seasonName: null }),
        isLive: false,
        rank: null,
        points: null,
        pps: null,
        ppPow: null,
        ppSpe: null,
        ppMen: null,
        ppSoc: null,
        cash: null,
        salaryTotal: null,
        marketValue: null,
        guv: null,
        topBuyPlayer: null,
        topBuyPlayerId: null,
        topBuyAmount: null,
        topSellPlayer: null,
        topSellPlayerId: null,
        topSellAmount: null,
        topSellProfit: null,
        injuriesCount: null,
        averageFatigue: null,
        disciplineValues: {},
      });
      const archivedHistoryRowsBySeasonId = new Map(
        [...archivedHistoryRows, ...projizierteHistorie]
          .filter((row) => row.seasonId !== input.gameState.season.id)
          .map((row) => [row.seasonId, row] as const),
      );
      const currentTeamSeasonNumber = getCurrentSeasonNumber(input.gameState);
      let history: TeamDetailDrawerHistoryRow[];
      if (currentTeamSeasonNumber == null) {
        // Fail-open: ohne auflösbare Season-Nummer bleibt die bisherige Logik.
        history = [currentHistoryRow, ...archivedHistoryRowsBySeasonId.values()];
      } else {
        const archivedSeasonNumbers = [...archivedHistoryRowsBySeasonId.keys()]
          .map((seasonId) => extractSeasonNumber({ seasonId, seasonName: null }))
          .filter((value): value is number => value != null);
        const firstTeamSeasonNumber =
          archivedSeasonNumbers.length > 0 ? Math.min(1, ...archivedSeasonNumbers) : 1;
        // Echte Snapshot-Season-IDs je Nummer wiederverwenden, fehlende Jahre als
        // kanonische `season-<n>`-ID synthetisieren.
        const seasonIdByNumber = new Map<number, string>();
        for (const seasonId of archivedHistoryRowsBySeasonId.keys()) {
          const number = extractSeasonNumber({ seasonId, seasonName: null });
          if (number != null && !seasonIdByNumber.has(number)) {
            seasonIdByNumber.set(number, seasonId);
          }
        }
        // Live-Zeile zuerst, danach absteigend (neueste zuerst) — wie zuvor.
        const rows: TeamDetailDrawerHistoryRow[] = [currentHistoryRow];
        for (let number = currentTeamSeasonNumber - 1; number >= firstTeamSeasonNumber; number -= 1) {
          const seasonId = seasonIdByNumber.get(number) ?? `season-${number}`;
          if (seasonId === input.gameState.season.id) {
            continue;
          }
          rows.push(archivedHistoryRowsBySeasonId.get(seasonId) ?? buildTeamHistoryPlaceholderRow(seasonId));
        }
        history = rows;
      }

      // Der Session-Cache (nur `scope: "full"`) darf niemals die Live-Zeile
      // ausliefern: `contentSignature` kennt weder Spieltag noch Ligastand, also
      // hätte ein Cache-Treffer sonst die Live-Saison mit dem Stand vom ERSTEN
      // Aufruf eingefroren — für die eigene Team-Ansicht, die als einzige diesen
      // Cache benutzt (die Teams-Detailansicht baut `history-summary` immer
      // frisch). `history` ist oben bereits neu gebaut und wird hier vor jedem
      // Cache-Rückgabepfad übergestülpt, damit beide Ansichten dieselbe frische
      // Live-Zeile zeigen (#298).
      if (scope === "full") {
        const cached = getCachedTeamProfileData(cacheKey, contentSignature);
        if (cached) {
          return { ...cached, history };
        }
      }

      const teamControl = getTeamControlSettings(input.gameState, team.teamId);
      const logo = getTeamLogoModel(team, { variant: "preview" });

      if (scope === "history-summary") {
        return {
          teamId: team.teamId,
          teamName: team.name,
          shortCode: team.shortCode,
          logoUrl: logo.src,
          logoInitials: logo.initials,
          controlMode: teamControl?.controlMode ?? "manual",
          generalManager: null,
          rosterSize: input.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
          cash: liveSeasonOverviewRow?.cash ?? team.cash ?? null,
          salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
          marketValueTotal: liveSeasonOverviewRow?.marketValueTotal ?? null,
          powRank: currentAreaRanks?.pow ?? null,
          speRank: currentAreaRanks?.spe ?? null,
          menRank: currentAreaRanks?.men ?? null,
          socRank: currentAreaRanks?.soc ?? null,
          contractSummaries: [],
          boardConfidence: null,
          relationships: { allies: [], rivals: [] },
          objectives: [],
          teamCaptain: null,
          history,
          allTimePps: summiereHistorienPps(history),
          allTimePpsRank: allTimePpsByTeamId.raenge.get(team.teamId) ?? null,
          allTimePpsTeamCount: allTimePpsByTeamId.teamCount > 0 ? allTimePpsByTeamId.teamCount : null,
          players: [],
        };
      }

      const generalManager = getTeamGeneralManager(input.gameState, team.teamId);
      const demandMap = buildTeamPlayerDemandMap(input.gameState, team.teamId);
      const teamCaptain = selectTeamCaptain(input.gameState, team.teamId);
      const drawerObjectives = input.teamObjectiveOverview.objectives.filter(
        (objective) => objective.teamId === team.teamId,
      );
      const drawerBoardConfidence = input.teamObjectiveOverview.boardConfidence[team.teamId] ?? null;
      const drawerRelationships = buildTeamRelationshipCards(input.gameState, team.teamId);
      const contractTable = buildTeamContractSeasonTable({
        gameState: input.gameState,
        teamId: team.teamId,
        seasonLabelBase: input.canonicalSeasonLabel,
      });
      const liveAverageSalary =
        liveSeasonOverviewRow?.rosterCount != null &&
        liveSeasonOverviewRow.rosterCount > 0 &&
        liveSeasonOverviewRow.salaryTotal != null
          ? roundViewNumber(liveSeasonOverviewRow.salaryTotal / liveSeasonOverviewRow.rosterCount, 2)
          : null;
      const rosterEntries = input.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const activePlayerIdSet = new Set(input.gameState.rosters.map((entry) => entry.playerId).filter(Boolean));
      const activePlayers = input.gameState.players.filter((player) => activePlayerIdSet.has(player.id));
      const playerCoreRankMaps = {
        pow: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.pow ?? 0 })),
        ),
        spe: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.spe ?? 0 })),
        ),
        men: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.men ?? 0 })),
        ),
        soc: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.soc ?? 0 })),
        ),
      };
      /**
       * Verkaufswerte je Spieler — aus DERSELBEN `contractTable`, die oben ohnehin schon für die
       * Gehaltssummen gebaut wird. Bewusst kein zweiter Aufruf von
       * `buildTransfermarktSaleFactorBreakdown`: der Verkaufsfaktor je Spieler ist nicht billig,
       * und zwei Quellen für dieselbe Zahl wären zwei Zahlen, sobald eine der beiden sich ändert.
       */
      const saleByPlayerId = new Map(
        contractTable.rows
          .filter((row) => row.status === "active")
          .map((row) => [row.playerId, { exitValue: row.exitValue, marketValueAtExit: row.marketValueAtExit }] as const),
      );
      const rosterCardsKnown = !isFoundationTeamManagementLocked(team.teamId, input.manageableTeamIds);
      const rosterCards = rosterEntries
        .map((entry) => {
          const player = input.gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
          if (!player) {
            return null;
          }
          const portrait = getPlayerPortraitModel(player);
          const rating = input.playerRatingsById.get(player.id) ?? null;
          const caPoStarFields = buildRosterCaPoStarFields({
            gameState: input.gameState,
            player,
            saveId,
            known: rosterCardsKnown,
            // CA = peak-gewichtete Current Ability aus den Corestats (#113), nicht Season-PPS.
            currentRating: computeCurrentAbilityScore(player.coreStats),
          });
          const topDisciplines = Object.entries(player.disciplineRatings)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 2)
            .map(([disciplineId, value]) => ({
              label:
                input.gameState.disciplines.find((discipline) => discipline.id === disciplineId)?.name ??
                disciplineId,
              value,
            }));
          const d1DisciplineId = input.currentMatchdayDisciplineSchedule?.discipline1?.disciplineId ?? null;
          const d2DisciplineId = input.currentMatchdayDisciplineSchedule?.discipline2?.disciplineId ?? null;
          const d1Score = d1DisciplineId ? player.disciplineRatings[d1DisciplineId] ?? null : null;
          const d2Score = d2DisciplineId ? player.disciplineRatings[d2DisciplineId] ?? null : null;
          const issueTags: string[] = [];
          if ((entry.contractLength ?? 0) <= 1) {
            issueTags.push("läuft aus");
          }
          const economy = resolvePlayerEconomyContract({ playerId: player.id, player, rosterEntry: entry });
          const marketValue = economy.marketValue;
          const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, input.gameState);
          const sale = saleByPlayerId.get(player.id) ?? null;
          const saleValue = sale?.exitValue ?? null;
          // Basis des Aufschlags ist `marketValueAtExit` (der Marktwert, gegen den der
          // Verkaufsfaktor gerechnet hat), nicht `economy.marketValue` — sonst stünde in der
          // Differenz auch noch der Unterschied zwischen zwei Marktwert-Quellen.
          const saleValueVsMarketValue =
            saleValue != null && sale?.marketValueAtExit != null
              ? roundViewNumber(saleValue - sale.marketValueAtExit, 2)
              : null;
          const salary = getRosterEntryDisplaySalary(entry, player);
          const salaryDelta = getRosterEntrySalaryDelta(entry, player, input.gameState);
          if (liveAverageSalary != null && salary > liveAverageSalary * 1.35) {
            issueTags.push("teuer");
          }
          if ((player.fatigue ?? 0) > 0) {
            issueTags.push("beansprucht");
          }

          return {
            playerId: player.id,
            activePlayerId: entry.id,
            name: player.name,
            portraitUrl: portrait.src,
            portraitInitials: portrait.initials,
            roleTag: entry.roleTag ?? null,
            promisedRole: entry.promisedRole ?? null,
            className: player.className ?? null,
            race: player.race ?? null,
            ovr: rating?.ovrNormalized ?? null,
            ovrRank: rating?.ovrRank ?? null,
            mvs: rating?.mvs ?? null,
            mvsRank: rating?.mvsRank ?? null,
            pps: rating?.ppsSeason ?? null,
            ppsRank: rating?.ppsSeasonRank ?? null,
            marketValue,
            marketValueDelta,
            saleValue,
            saleValueVsMarketValue,
            salary,
            salaryDelta,
            contractLength: entry.contractLength ?? null,
            d1Label: input.currentMatchdayDisciplineSchedule?.discipline1?.displayName ?? "D1",
            d1Score,
            d2Label: input.currentMatchdayDisciplineSchedule?.discipline2?.displayName ?? "D2",
            d2Score,
            coreStats: {
              pow: player.coreStats.pow ?? null,
              powRank: playerCoreRankMaps.pow.get(player.id) ?? null,
              spe: player.coreStats.spe ?? null,
              speRank: playerCoreRankMaps.spe.get(player.id) ?? null,
              men: player.coreStats.men ?? null,
              menRank: playerCoreRankMaps.men.get(player.id) ?? null,
              soc: player.coreStats.soc ?? null,
              socRank: playerCoreRankMaps.soc.get(player.id) ?? null,
            },
            // Saison-PPs je Achse — die Ligaränge kommen fertig aus dem Rating-Row, hier wird
            // nichts nachgerechnet.
            axisPps: {
              pow: rating?.ppPow ?? null,
              powRank: rating?.ppPowRank ?? null,
              spe: rating?.ppSpe ?? null,
              speRank: rating?.ppSpeRank ?? null,
              men: rating?.ppMen ?? null,
              menRank: rating?.ppMenRank ?? null,
              soc: rating?.ppSoc ?? null,
              socRank: rating?.ppSocRank ?? null,
            },
            issueTags,
            demands: (demandMap.get(player.id) ?? []).map((demand) => ({
              demandId: demand.demandId,
              label: demand.label,
              detail: demand.detail,
              status: demand.status,
              priority: demand.priority,
              targetDisciplineId: demand.targetDisciplineId ?? null,
              moraleReward: demand.moraleReward,
              moralePenalty: demand.moralePenalty,
            })),
            topDisciplines,
            potential: player.potential ?? null,
            potentialBand: player.potential != null ? getPotentialBand(player.potential) : null,
            ...caPoStarFields,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => {
          const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
          if (ovrDelta !== 0) {
            return ovrDelta;
          }

          const mvsDelta = (right.mvs ?? Number.NEGATIVE_INFINITY) - (left.mvs ?? Number.NEGATIVE_INFINITY);
          if (mvsDelta !== 0) {
            return mvsDelta;
          }

          return left.name.localeCompare(right.name, "de");
        });

      const result = {
        teamId: team.teamId,
        teamName: team.name,
        shortCode: team.shortCode,
        logoUrl: logo.src,
        logoInitials: logo.initials,
        controlMode: teamControl?.controlMode ?? "manual",
        generalManager: generalManager
          ? {
              name: generalManager.profile.name,
              title: generalManager.profile.title,
              description: generalManager.profile.description,
              pow: generalManager.profile.pow,
              spe: generalManager.profile.spe,
              men: generalManager.profile.men,
              soc: generalManager.profile.soc,
              influencePct: generalManager.assignment.influencePct,
              playerOptDelta: generalManager.profile.playerOptDelta,
              marketDoctrine: generalManager.profile.marketDoctrine,
              lineupDoctrine: generalManager.profile.lineupDoctrine,
              facilityPriorities: generalManager.profile.facilityPriorities,
              bias: generalManager.profile.bias,
            }
          : null,
        rosterSize: rosterCards.length,
        cash: liveSeasonOverviewRow?.cash ?? team.cash ?? null,
        salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
        marketValueTotal: liveSeasonOverviewRow?.marketValueTotal ?? null,
        powRank: currentAreaRanks?.pow ?? null,
        speRank: currentAreaRanks?.spe ?? null,
        menRank: currentAreaRanks?.men ?? null,
        socRank: currentAreaRanks?.soc ?? null,
        contractSummaries: contractTable.totalsCommitted,
        boardConfidence: drawerBoardConfidence
          ? {
              value: drawerBoardConfidence.value,
              pressure: drawerBoardConfidence.pressure,
              warnings: drawerBoardConfidence.warnings,
            }
          : null,
        relationships: drawerRelationships,
        objectives: drawerObjectives.map((objective) => ({
          objectiveId: objective.objectiveId,
          label: objective.label,
          detail: objective.detail ?? null,
          actionHint: objective.actionHint ?? null,
          category: objective.category,
          targetValue: objective.targetValue,
          currentValue: objective.currentValue,
          status: objective.status,
        })),
        teamCaptain: teamCaptain
          ? {
              playerId: teamCaptain.playerId,
              playerName: teamCaptain.playerName,
              leadershipScore: teamCaptain.leadershipScore,
              style: teamCaptain.style,
              effects: teamCaptain.effects,
              traitSignals: teamCaptain.traitSignals,
            }
          : null,
        history,
        allTimePps: summiereHistorienPps(history),
        allTimePpsRank: allTimePpsByTeamId.raenge.get(team.teamId) ?? null,
        allTimePpsTeamCount: allTimePpsByTeamId.teamCount > 0 ? allTimePpsByTeamId.teamCount : null,
        players: rosterCards,
      };
      if (scope === "full") {
        setCachedTeamProfileData(cacheKey, contentSignature, result);
      }
      return result;
    },
    [
      input.canonicalSeasonLabel,
      input.currentAreaRanksByTeamId,
      input.currentMatchdayDisciplineSchedule,
      input.gameState,
      input.manageableTeamIds,
      input.playerRatingsById,
      input.seasonPointsLedger,
      liveSeasonStandRows,
      input.teamObjectiveOverview.boardConfidence,
      input.teamObjectiveOverview.objectives,
    ],
  );

  const teamProfileData = useMemo<TeamDetailDrawerData | null>(() => {
    if (!shouldBuildFoundationTeamProfileData(input.teamProfileTeamId)) {
      return null;
    }
    return buildTeamDetailDrawerData(input.teamProfileTeamId, "full");
  }, [
    buildTeamDetailDrawerData,
    input.teamProfileTeamId,
  ]);

  return {
    selectedRosterTableRows,
    buildTeamDetailDrawerData,
    teamProfileData,
  };
}
