import { useMemo } from "react";

import type { DisciplineCategory, GamePhase, GameState, NewGameFlowStepId, NewGameFlowStepStatus, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel } from "@/lib/facilities/facility-effects";
import { buildSeasonReadinessChecklist } from "@/lib/foundation/season-readiness-checklist";
import { isTeamTrainingComplete } from "@/lib/foundation/team-training-status";
import { formatWholeNumber } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import type {
  FoundationPrizePreviewResponse,
  SeasonSetupStepTone,
  SeasonSetupStepViewTarget,
} from "@/lib/foundation/tabs/foundation-page-types";
import type { HomeNextMatchdayStatus } from "@/lib/foundation/tabs/use-foundation-cross-tab-matchday-lineup";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { findOwnRoomParticipant } from "@/lib/room/online-room-model";
import { getDisciplineColor } from "@/lib/season/season-discipline-schedule";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import type { OlyRoomState } from "@/types/game";

type CurrentMatchdayDisciplineSchedule = {
  discipline1?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
  discipline2?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
} | null;

type SeasonDisciplineScheduleRow = {
  matchdayId: string;
  matchdayLabel?: string | null;
  discipline1?: {
    disciplineId?: string | null;
    displayName?: string | null;
    playerCount?: number | null;
    category?: DisciplineCategory | null;
  } | null;
  discipline2?: {
    disciplineId?: string | null;
    displayName?: string | null;
    playerCount?: number | null;
    category?: DisciplineCategory | null;
  } | null;
};

type TeamFacilityState = Parameters<typeof getFacilityLevel>[0];

type TeamSponsorContract = { name: string } | null | undefined;

type RosterPlayerRow = { player: Player; entry: RosterEntry };

export function shouldBuildFoundationSeasonTransitionGate(activeView: string): boolean {
  return (
    activeView === "seasonV2" ||
    activeView === "cockpit" ||
    activeView === "homeV2" ||
    activeView === "prize" ||
    activeView === "teams" ||
    activeView === "teamSettings"
  );
}

export function shouldBuildFoundationSeasonSetupFlow(activeView: string): boolean {
  return activeView === "home" || activeView === "homeV2" || activeView === "cockpit";
}

export function shouldBuildFoundationSeasonBriefingData(activeView: string): boolean {
  return (
    activeView === "home" ||
    activeView === "homeV2" ||
    activeView === "seasonPreview" ||
    activeView === "cockpit"
  );
}

export function shouldBuildFoundationSeasonReadinessChecklist(
  activeView: string,
  homeV2Tab: string = "overview",
): boolean {
  return activeView === "cockpit" || (activeView === "homeV2" && homeV2Tab === "office");
}

export function resolveSeasonBriefingMatchdayHighlights(input: {
  discipline1PlayerCount?: number | null;
  discipline2PlayerCount?: number | null;
  sameCategory: boolean;
}) {
  const count1 = input.discipline1PlayerCount;
  const count2 = input.discipline2PlayerCount;
  const totalSlots = count1 != null && count2 != null ? count1 + count2 : null;
  const isHeavyRoster = totalSlots === 11 || totalSlots === 12;
  const isHeavySameColor = isHeavyRoster && input.sameCategory;

  return {
    totalSlots,
    isHeavyRoster,
    isHeavySameColor,
  };
}

const EMPTY_SEASON_TRANSITION_GATE = {
  gamePhase: "season_active" as const,
  canCompleteSeason: false,
  disabledReason: "last_matchday_not_completed" as const,
  lastMatchdayId: "",
  hostOnly: false,
};

export type LocalSeasonTransitionGate = {
  gamePhase: GamePhase;
  canCompleteSeason: boolean;
  disabledReason: string | null;
  lastMatchdayId: string;
  hostOnly: boolean;
};

/**
 * Reine Funktion statt Inline-Logik im `useMemo` — als eigener Exportnamen direkt testbar
 * (tests/season-transition-host-gate.test.ts, Paket B), ohne React rendern zu muessen. Gleiches
 * Muster wie `buildSeasonPlayabilityGate` (lib/foundation/season-playability-gate.ts): der Gate-
 * Baustein ist eine pure Funktion, der Hook ruft sie nur noch auf.
 */
export function buildLocalSeasonTransitionGate(input: {
  gameState: GameState;
  roomContext: FoundationRoomContext | null;
  roomLiveState: OlyRoomState | null;
}): LocalSeasonTransitionGate {
  const matchdayIds = input.gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? input.gameState.matchdayState.matchdayId;
  const lastFixtures = input.gameState.seasonState.schedule.filter((fixture) => fixture.matchdayId === lastMatchdayId);
  const lastFixturesResolved =
    lastFixtures.length === 0 || lastFixtures.every((fixture) => fixture.status === "resolved");
  const hasLastMatchdayResult = (input.gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === input.gameState.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (input.gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === input.gameState.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeMatchdayIsLast =
    input.gameState.matchdayState.matchdayId === lastMatchdayId ||
    input.gameState.season.currentMatchday >= matchdayIds.length;
  const transitionReadyPhase =
    input.gameState.gamePhase !== undefined && input.gameState.gamePhase !== "season_active";
  const canCompleteSeason =
    transitionReadyPhase ||
    (activeMatchdayIsLast &&
      input.gameState.matchdayState.status === "resolved" &&
      (lastFixturesResolved || (hasLastMatchdayResult && hasLastStandingsApply)));

  // BEFUND (Paket B, docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): `season_completion` und
  // `season_transition` sind HOST_LEVEL_ACTIONS (server-authoritative-write-guard.ts:332-336,
  // `participant.role === "host"`) — der Gast bekam den Riegel bisher nur als 403 NACH dem
  // Klick zu sehen. Diese Spiegelung macht ihn VORHER sichtbar, ohne die Server-Autoritaet zu
  // verdoppeln: sie entscheidet nichts, sie zeigt nur an, was der Server ohnehin ablehnen wuerde.
  // Solo (`roomContext` null) und Host bleiben unveraendert `false` — die Eigenschaft, die
  // `hostOnly` NICHT beeinflusst, ist `canCompleteSeason` selbst: der zweite Verbraucher
  // (use-foundation-cross-tab-screen-primary-action.ts) liest genau dieses Feld fuer Frankys
  // EIGENE Saisonende-Aktionen (Verkaufen/Verlaengern), die explizit KEINE Host-Aktionen sind
  // (server-authoritative-write-guard.ts, `contract_renewal`/`contract_dissolution`/
  // `sponsor_choice` stehen nicht in HOST_LEVEL_ACTIONS). Wuerde `hostOnly` hier in
  // `canCompleteSeason` einfliessen, spraeche das Gate Franky genau die Aktionen ab, die er
  // sehr wohl darf — der zu breite Riegel, den Eigenschaft 4 im Plan verbietet.
  /**
   * NUR BEHAUPTEN, WAS BEKANNT IST. Der erste Anlauf schrieb `ownRoomParticipant?.role !== "host"`
   * — und traf damit ausgerechnet den, der darf: `roomLiveState` ist der zuletzt EMPFANGENE
   * Schnappschuss und ist `null`, solange keiner da ist. Das ist kein Randfall, sondern jeder
   * Seitenaufbau im Raum (der Kontext steht sofort, der Schnappschuss kommt erst mit
   * `roomJoined`/`roomState` ueber den Socket) und zusaetzlich der Sitzungsfehler-Pfad aus Befund
   * F6, der ihn wieder auf `null` setzt. Gemessen: Kontext gesetzt + Schnappschuss fehlt ->
   * `hostOnly: true`, also "Nur der Host …" fuer den Host.
   *
   * Bei UNBEKANNTER Rolle wird deshalb nichts behauptet. Die Kosten sind unsymmetrisch: sagt die
   * Anzeige dem Host faelschlich, er duerfe nicht, ist das schlicht falsch und er sitzt fest.
   * Sagt sie dem Gast in diesem kurzen Fenster nichts, klickt er wie bisher und bekommt die
   * lesbare Absage des Servers (Befund F9) — das ist genau der Zustand vor diesem Paket, also
   * kein Rueckschritt. Die Autoritaet liegt ohnehin beim Server, hier haengt nur die Anzeige.
   */
  const eigenerSitz = input.roomContext
    ? findOwnRoomParticipant(input.roomLiveState, input.roomContext.participantId)
    : null;
  const hostOnly = Boolean(input.roomContext) && eigenerSitz != null && eigenerSitz.role !== "host";

  return {
    gamePhase: input.gameState.gamePhase ?? "season_active",
    canCompleteSeason,
    disabledReason: hostOnly ? "season_transition_host_only" : canCompleteSeason ? null : "last_matchday_not_completed",
    lastMatchdayId,
    hostOnly,
  };
}

const EMPTY_SEASON_BRIEFING_DATA = {
  currentFactor: null as number | null,
  futureFactors: [] as Array<{ label: string; factor: number }>,
  firstMatchdays: [] as Array<{
    matchdayId: string;
    label: string;
    disciplines: Array<{
      name: string | null | undefined;
      playerCount: number | null | undefined;
      category: string | null | undefined;
      color: string;
    }>;
    sameColor: boolean;
    totalSlots: number | null;
    isHeavyRoster: boolean;
    isHeavySameColor: boolean;
  }>,
  bigDisciplines: [] as Array<{
    matchdayId: string;
    matchdayLabel: string;
    matchdayIndex: number;
    slotIndex: number;
    color: string;
    disciplineId?: string | null;
    displayName?: string | null;
    playerCount?: number | null;
    category?: string | null;
  }>,
  sameColorMatchdays: [] as Array<{
    matchdayId: string;
    label: string;
    disciplines: Array<{
      name: string | null | undefined;
      playerCount: number | null | undefined;
      category: string | null | undefined;
      color: string;
    }>;
    sameColor: boolean;
  }>,
  categoryCounts: { power: 0, speed: 0, mental: 0, social: 0 },
  scheduleCount: 0,
};

export function useFoundationCrossTabSeasonBriefing(input: {
  activeView: string;
  homeV2Tab?: string;
  activeSaveId: string;
  activeManagerTeamId: string | null;
  gameState: GameState;
  /**
   * KOOP: der fuer DIESE Sitzung geltende Einstiegs-Flow (bereits mit
   * `resolveScopedNewGameFlow` aufgeloest, siehe use-foundation-shell-router-body-scope.tsx).
   * NICHT `gameState.seasonState.newGameFlow` direkt lesen — das ist das geteilte
   * Top-Level-Objekt fuer den ganzen Save und wuerde Chris' Fortschritt faelschlich auch fuer
   * Franky anzeigen (siehe Messbefund in tests/coop-onboarding-new-game-flow-zwei-sitzungen.test.ts).
   */
  newGameFlow: GameState["seasonState"]["newGameFlow"];
  /**
   * KOOP (Paket B): braucht das Gate nur fuer den Host-Vorbehalt am Saisonwechsel — `null`/`null`
   * heisst Solo, dort bleibt `hostOnly` immer `false` (siehe Eigenschaft 2 im Plan).
   */
  roomContext: FoundationRoomContext | null;
  roomLiveState: OlyRoomState | null;
  selectedTeam: Team | null;
  rosterPlayers: RosterPlayerRow[];
  selectedTeamFacilityState: TeamFacilityState;
  selectedTeamSponsorContract: TeamSponsorContract;
  currentMatchdayDisciplineSchedule: CurrentMatchdayDisciplineSchedule;
  homeNextMatchdayStatus: HomeNextMatchdayStatus;
  seasonDisciplineScheduleRows: SeasonDisciplineScheduleRow[];
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
}) {
  const shouldBuildSeasonTransitionGate = shouldBuildFoundationSeasonTransitionGate(input.activeView);
  const shouldBuildSeasonSetupFlow = shouldBuildFoundationSeasonSetupFlow(input.activeView);
  const shouldBuildSeasonBriefingData = shouldBuildFoundationSeasonBriefingData(input.activeView);
  const shouldBuildSeasonReadinessChecklist = shouldBuildFoundationSeasonReadinessChecklist(
    input.activeView,
    input.homeV2Tab,
  );

  const localSeasonTransitionGate = useMemo(() => {
    if (!shouldBuildSeasonTransitionGate) {
      return EMPTY_SEASON_TRANSITION_GATE;
    }
    return buildLocalSeasonTransitionGate({
      gameState: input.gameState,
      roomContext: input.roomContext,
      roomLiveState: input.roomLiveState,
    });
  }, [input.gameState, input.roomContext, input.roomLiveState, shouldBuildSeasonTransitionGate]);

  const seasonSetupFlow = useMemo(() => {
    if (!shouldBuildSeasonSetupFlow || !input.selectedTeam) {
      return null;
    }

    const storedFlow = input.newGameFlow ?? null;
    const currentSeasonText = `${input.gameState.season.id} ${input.gameState.season.name}`.toLowerCase();
    const isFirstSeason = /season[-_\s]*1\b/.test(currentSeasonText) || /\bsaison[-_\s]*1\b/.test(currentSeasonText);
    const hasSeasonResults = (input.gameState.seasonState.matchdayResults ?? []).some(
      (result) => result.seasonId === input.gameState.season.id,
    );
    const shouldShow =
      Boolean(storedFlow?.active && !storedFlow.dismissed) ||
      (isFirstSeason && !hasSeasonResults && !storedFlow?.dismissed && !storedFlow?.completedAt);

    if (!shouldShow) {
      return null;
    }
    const selectedTeam = input.selectedTeam;

    const storedStatusById = new Map<NewGameFlowStepId, NewGameFlowStepStatus>(
      (storedFlow?.steps ?? []).map((step) => [step.stepId, step.status]),
    );
    const rosterCount = input.rosterPlayers.length;
    const targetRosterCount = Math.max(10, Math.min(12, selectedTeam.rosterLimit ?? 12));
    const activeTransfers = input.gameState.transferHistory.some(
      (transfer) =>
        transfer.seasonId === input.gameState.season.id &&
        (transfer.toTeamId === selectedTeam.teamId || transfer.fromTeamId === selectedTeam.teamId),
    );
    const facilityUpgradeCount = FACILITY_CATALOG.reduce(
      (sum, facility) => sum + (getFacilityLevel(input.selectedTeamFacilityState, facility.facilityId) > 1 ? 1 : 0),
      0,
    );
    // "Training gesetzt" einheitlich wie Game-Flow/Readiness bestimmen (nicht
    // mehr über facilityUpgradeCount), damit alle Oberflächen denselben
    // Abschlusszustand zeigen.
    const trainingComplete = isTeamTrainingComplete(input.gameState, selectedTeam.teamId);
    const axisAverages = [
      {
        label: "POW",
        value:
          input.rosterPlayers.reduce((sum, row) => sum + row.player.coreStats.pow, 0) / Math.max(rosterCount, 1),
      },
      {
        label: "SPE",
        value:
          input.rosterPlayers.reduce((sum, row) => sum + row.player.coreStats.spe, 0) / Math.max(rosterCount, 1),
      },
      {
        label: "MEN",
        value:
          input.rosterPlayers.reduce((sum, row) => sum + row.player.coreStats.men, 0) / Math.max(rosterCount, 1),
      },
      {
        label: "SOC",
        value:
          input.rosterPlayers.reduce((sum, row) => sum + row.player.coreStats.soc, 0) / Math.max(rosterCount, 1),
      },
    ].sort((left, right) => right.value - left.value);
    const strongestAxis = axisAverages[0] ?? null;
    const weakestAxis = axisAverages[axisAverages.length - 1] ?? null;
    const getResolvedStatus = (stepId: NewGameFlowStepId, autoCompleted: boolean): SeasonSetupStepTone => {
      if (autoCompleted || storedStatusById.get(stepId) === "completed") {
        return "completed";
      }
      if (storedStatusById.get(stepId) === "skipped") {
        return "skipped";
      }
      return "open";
    };
    const steps: Array<{
      stepId: NewGameFlowStepId;
      title: string;
      kicker: string;
      detail: string;
      targetLabel: string;
      targetView: SeasonSetupStepViewTarget;
      status: SeasonSetupStepTone;
      progress: string;
    }> = [
      {
        stepId: "season_intro",
        title: "Season-Briefing",
        kicker: "Startsignal",
        detail: "Salary Factor, Diszi-Reihenfolge, große Slot-Tage und Farb-Dopplungen einmal lesen.",
        targetLabel: "Briefing öffnen",
        targetView: "home",
        status: getResolvedStatus("season_intro", false),
        progress: "wichtig",
      },
      {
        stepId: "team_confirm",
        title: "Team wählen",
        kicker: "Start",
        detail: `${selectedTeam.shortCode} ist aktiv. Wechsel, wenn du ein anderes Team starten willst.`,
        targetLabel: "Team prüfen",
        targetView: "manager_team",
        status: getResolvedStatus("team_confirm", Boolean(selectedTeam.teamId)),
        progress: selectedTeam.shortCode,
      },
      {
        stepId: "roster_review",
        title: "Kader prüfen",
        kicker: "Dossier",
        detail:
          rosterCount > 0
            ? `Stärke ${strongestAxis?.label ?? "—"} ${formatWholeNumber(strongestAxis?.value)} · Lücke ${weakestAxis?.label ?? "—"} ${formatWholeNumber(weakestAxis?.value)}.`
            : "Noch kein aktiver Kader vorhanden.",
        targetLabel: "Kader öffnen",
        targetView: "teams",
        status: getResolvedStatus("roster_review", rosterCount > 0),
        progress: `${rosterCount} Spieler`,
      },
      // Der Sponsor steht VOR den Transfers: er ist die Bezugsgroesse fuer das, was man sich an
      // Gehaeltern leisten kann. Vorher war er der vorletzte Punkt der Liste, also hinter beiden
      // Kaufschritten — man verpflichtete Spieler, bevor man sein Budget kannte. Die Reihenfolge
      // muss zu `buildOnboardingFlowSteps` passen, sonst zeigt das Fenster etwas anderes an, als
      // der "Weiter"-Knopf tut.
      {
        stepId: "choose_sponsor",
        title: "Sponsor wählen",
        kicker: "Budget",
        detail: input.selectedTeamSponsorContract
          ? `Aktiver Sponsor: ${input.selectedTeamSponsorContract.name}.`
          : "Wähle einen von drei Sponsor-Verträgen — er setzt den Rahmen für Gehälter und Objectives.",
        targetLabel: "Sponsor prüfen",
        // NICHT "teams": gewaehlt wird im Sponsoren-Reiter. Das Ziel zeigte auf die Team-Seite,
        // auf der es gar keine Sponsor-Auswahl gibt.
        targetView: "prize",
        status: getResolvedStatus("choose_sponsor", Boolean(input.selectedTeamSponsorContract)),
        progress: input.selectedTeamSponsorContract ? "aktiv" : "offen",
      },
      {
        stepId: "first_transfers",
        title: "Erste Transfers",
        kicker: "Markt",
        detail: "Oeffnet den Markt mit Team-Fit, Value-Ratio und Kaderlücken im Fokus.",
        targetLabel: "Deals suchen",
        targetView: "market",
        status: getResolvedStatus("first_transfers", activeTransfers),
        progress: activeTransfers ? "Transfer aktiv" : "Filter bereit",
      },
      {
        stepId: "fill_roster",
        title: "Kader auffüllen",
        kicker: "Tiefe",
        detail: `Ziel: mindestens ${targetRosterCount} aktive Spieler, damit Slots und Rotation nicht sofort brennen.`,
        targetLabel: "Spieler finden",
        targetView: "market",
        status: getResolvedStatus("fill_roster", rosterCount >= targetRosterCount),
        progress: `${rosterCount}/${targetRosterCount}`,
      },
      {
        stepId: "training_facilities",
        title: "Training setzen",
        kicker: "Basis",
        detail: trainingComplete
          ? `Trainingsmodi gesetzt.${facilityUpgradeCount > 0 ? ` ${facilityUpgradeCount} Facility-Upgrades aktiv.` : ""}`
          : "Jedem Kader-Spieler einen Trainingsmodus geben (Scouting/Gebäude optional).",
        targetLabel: "Training öffnen",
        targetView: "trainingV2",
        status: getResolvedStatus("training_facilities", trainingComplete),
        progress: trainingComplete ? "gesetzt" : "offen",
      },
      {
        stepId: "appoint_captain",
        title: "Kapitän wählen",
        kicker: "Führung",
        detail: "Ernenne einen Saison-Kapitän — Moral-Puffer, Team-Power und Rivalitäts-Druck hängen davon ab.",
        targetLabel: "Office öffnen",
        targetView: "home",
        status: getResolvedStatus(
          "appoint_captain",
          Boolean(
            input.gameState.teamCaptains?.some(
              (entry) => entry.seasonId === input.gameState.season.id && entry.teamId === selectedTeam.teamId,
            ),
          ),
        ),
        progress: "Saison-Rolle",
      },
      {
        stepId: "set_lineup",
        title: "Einsatzliste setzen",
        kicker: "Matchday",
        detail: `${input.currentMatchdayDisciplineSchedule?.discipline1?.displayName ?? "D1"} / ${input.currentMatchdayDisciplineSchedule?.discipline2?.displayName ?? "D2"}: Slots füllen, Powers/Captains bewusst setzen.`,
        targetLabel: "Einsatzliste öffnen",
        targetView: "lineup",
        status: getResolvedStatus(
          "set_lineup",
          input.homeNextMatchdayStatus.requiredSlots > 0 && input.homeNextMatchdayStatus.openSlots === 0,
        ),
        progress:
          input.homeNextMatchdayStatus.requiredSlots > 0
            ? `${input.homeNextMatchdayStatus.filledSlots}/${input.homeNextMatchdayStatus.requiredSlots}`
            : "—",
      },
    ];
    const completedCount = steps.filter((step) => step.status === "completed").length;
    const handledCount = steps.filter((step) => step.status === "completed" || step.status === "skipped").length;
    const openStep = steps.find((step) => step.status === "open") ?? null;

    return {
      steps,
      completedCount,
      handledCount,
      isReady: handledCount === steps.length,
      openStep,
      rosterCount,
      targetRosterCount,
      strongestAxis,
      weakestAxis,
    };
  }, [
    input.currentMatchdayDisciplineSchedule?.discipline1?.displayName,
    input.currentMatchdayDisciplineSchedule?.discipline2?.displayName,
    input.gameState,
    input.newGameFlow,
    input.homeNextMatchdayStatus.filledSlots,
    input.homeNextMatchdayStatus.openSlots,
    input.homeNextMatchdayStatus.requiredSlots,
    input.rosterPlayers,
    input.selectedTeam,
    input.selectedTeamFacilityState,
    input.selectedTeamSponsorContract,
    shouldBuildSeasonSetupFlow,
  ]);

  const seasonBriefingData = useMemo(() => {
    if (!shouldBuildSeasonBriefingData) {
      return EMPTY_SEASON_BRIEFING_DATA;
    }

    const factorWindow = getSeasonEconomyFactorWindow({
      saveId: input.activeSaveId,
      seasonId: input.gameState.season.id,
      seasonState: input.gameState.seasonState,
    });
    const currentFactor = input.prizePreviewFeed?.summary.currentFactor ?? factorWindow[0]?.factor ?? null;
    const futureFactors = factorWindow.slice(1, 5).map((entry) => ({
      label: entry.seasonLabel,
      factor: entry.factor,
    }));
    const slots = input.seasonDisciplineScheduleRows.flatMap((entry, matchdayIndex) =>
      [entry.discipline1, entry.discipline2]
        .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
        .map((slot, slotIndex) => ({
          ...slot,
          matchdayId: entry.matchdayId,
          matchdayLabel: entry.matchdayLabel || `Spieltag ${matchdayIndex + 1}`,
          matchdayIndex,
          slotIndex,
          color: getDisciplineColor(slot.category) ?? "neutral",
        })),
    );
    const firstMatchdays = input.seasonDisciplineScheduleRows.map((entry, index) => {
      const sameColor = Boolean(
        entry.discipline1 && entry.discipline2 && entry.discipline1.category === entry.discipline2.category,
      );
      const highlights = resolveSeasonBriefingMatchdayHighlights({
        discipline1PlayerCount: entry.discipline1?.playerCount,
        discipline2PlayerCount: entry.discipline2?.playerCount,
        sameCategory: sameColor,
      });

      return {
        matchdayId: entry.matchdayId,
        label: entry.matchdayLabel || `Spieltag ${index + 1}`,
        disciplines: [entry.discipline1, entry.discipline2]
          .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
          .map((slot) => ({
            name: slot.displayName,
            playerCount: slot.playerCount ?? null,
            category: slot.category,
            color: getDisciplineColor(slot.category) ?? "neutral",
          })),
        sameColor,
        totalSlots: highlights.totalSlots,
        isHeavyRoster: highlights.isHeavyRoster,
        isHeavySameColor: highlights.isHeavySameColor,
      };
    });
    const bigDisciplines = [...slots]
      .sort(
        (left, right) =>
          (right.playerCount ?? 0) - (left.playerCount ?? 0) ||
          left.matchdayIndex - right.matchdayIndex ||
          left.slotIndex - right.slotIndex,
      )
      .slice(0, 8);
    const sameColorMatchdays = firstMatchdays.filter((entry) => entry.sameColor);
    const categoryCounts = slots.reduce(
      (acc, slot) => {
        if (slot.category === "power") acc.power += 1;
        if (slot.category === "speed") acc.speed += 1;
        if (slot.category === "mental") acc.mental += 1;
        if (slot.category === "social") acc.social += 1;
        return acc;
      },
      { power: 0, speed: 0, mental: 0, social: 0 },
    );

    return {
      currentFactor,
      futureFactors,
      firstMatchdays,
      bigDisciplines,
      sameColorMatchdays,
      categoryCounts,
      scheduleCount: input.seasonDisciplineScheduleRows.length,
    };
  }, [
    input.activeSaveId,
    input.gameState.season.id,
    input.gameState.seasonState,
    input.prizePreviewFeed?.summary.currentFactor,
    input.seasonDisciplineScheduleRows,
    shouldBuildSeasonBriefingData,
  ]);

  const seasonReadinessChecklist = useMemo(
    () =>
      shouldBuildSeasonReadinessChecklist
        ? buildSeasonReadinessChecklist({
            gameState: input.gameState,
            teamId: input.activeManagerTeamId,
          })
        : null,
    [input.activeManagerTeamId, input.gameState, shouldBuildSeasonReadinessChecklist],
  );

  return {
    localSeasonTransitionGate,
    seasonSetupFlow,
    seasonBriefingData,
    seasonReadinessChecklist,
  };
}
