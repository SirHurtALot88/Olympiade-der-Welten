import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getTeamBoardFlowSignals } from "@/lib/board/team-season-objectives-service";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { isTeamMatchdayLineupComplete, isTeamMatchdayLineupSubmitted } from "@/lib/foundation/matchday-lineup-readiness";
import { isTeamTrainingComplete } from "@/lib/foundation/team-training-status";

export type SeasonReadinessItemStatus = "ready" | "open" | "blocked";

export type SeasonReadinessItem = {
  id: string;
  label: string;
  detail: string;
  status: SeasonReadinessItemStatus;
  targetView: FoundationViewId;
  targetPanel?: string | null;
};

export type SeasonReadinessChecklist = {
  phase: "preseason" | "season_active" | "season_end";
  title: string;
  items: SeasonReadinessItem[];
  readyCount: number;
  totalCount: number;
};

function rosterPlayerIds(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

function teamTrainingComplete(gameState: GameState, teamId: string) {
  // Einheitliche Quelle der Wahrheit (siehe team-training-status).
  return isTeamTrainingComplete(gameState, teamId);
}

function activeLineupDraft(gameState: GameState, teamId: string) {
  return (
    (gameState.seasonState.lineupDrafts ?? []).find(
      (draft) =>
        draft.teamId === teamId &&
        draft.seasonId === gameState.season.id &&
        draft.matchdayId === gameState.matchdayState.matchdayId,
    ) ?? null
  );
}

function buildSeasonActiveItems(gameState: GameState, teamId: string): SeasonReadinessItem[] {
  const rosterCount = rosterPlayerIds(gameState, teamId).length;
  const lineupDraft = activeLineupDraft(gameState, teamId);
  const lineupComplete = isTeamMatchdayLineupComplete(gameState, teamId, lineupDraft);
  const lineupSubmitted = isTeamMatchdayLineupSubmitted(lineupDraft);
  const boardSignals = getTeamBoardFlowSignals(gameState, teamId);
  const sponsorContract = getTeamSponsorContract(gameState, teamId);

  return [
    {
      id: "sponsor",
      label: "Sponsor gewählt",
      detail: sponsorContract ? `${sponsorContract.name} aktiv.` : "Sponsor-Angebot noch offen.",
      status: sponsorContract ? "ready" : "open",
      targetView: "prize",
      targetPanel: "team-sponsor-choice",
    },
    {
      id: "training",
      label: "Training gesetzt",
      detail: teamTrainingComplete(gameState, teamId)
        ? "Alle Kader-Spieler haben einen Modus."
        : "Mindestens ein Spieler ohne Trainingsmodus.",
      status: teamTrainingComplete(gameState, teamId) ? "ready" : rosterCount > 0 ? "open" : "blocked",
      targetView: "trainingCompact",
    },
    {
      id: "lineup",
      label: "Lineup bestätigt",
      detail: lineupSubmitted
        ? "Einsatzliste für den aktuellen Spieltag bestätigt."
        : lineupComplete
          ? "Slots voll — bitte in der Einsatzliste bestätigen."
          : "Einsatzliste noch nicht spielbereit.",
      status: lineupSubmitted ? "ready" : lineupComplete ? "open" : rosterCount > 0 ? "open" : "blocked",
      targetView: "lineup",
    },
    {
      id: "board",
      label: "Board-Ziele gelesen",
      detail:
        boardSignals.blockers.length > 0
          ? "Mindestens ein Board-Ziel verfehlt."
          : boardSignals.warnings.length > 0
            ? "Board-Ziele unter Druck."
            : "Board-Signale stabil.",
      status: boardSignals.blockers.length > 0 ? "blocked" : boardSignals.warnings.length > 0 ? "open" : "ready",
      targetView: "teams",
      targetPanel: "board-objectives",
    },
  ];
}

function buildSeasonEndItems(gameState: GameState): SeasonReadinessItem[] {
  const seasonId = gameState.season.id;
  const prizeApplied = (gameState.seasonState.cashPrizeApplyLogs ?? []).some((log) => log.seasonId === seasonId);
  const developmentApplied = (gameState.playerProgressionEvents ?? []).some((event) => event.seasonId === seasonId);
  const seasonReviewReady = gameState.gamePhase === "season_completed" || gameState.gamePhase === "season_review";

  return [
    {
      id: "prize",
      label: "Preisgeld gebucht",
      detail: prizeApplied ? "Saison-Preisgeld angewendet." : "Preisgeld noch offen.",
      status: prizeApplied ? "ready" : "open",
      targetView: "prize",
    },
    {
      id: "development",
      label: "Spielerentwicklung",
      detail: developmentApplied ? "Entwicklung durchgeführt." : "Entwicklung noch ausstehend.",
      status: developmentApplied ? "ready" : "open",
      targetView: "cockpit",
      targetPanel: "season-review",
    },
    {
      id: "review",
      label: "Saisonrückblick",
      detail: seasonReviewReady ? "Season Review bereit." : "Saison noch aktiv.",
      status: seasonReviewReady ? "open" : "blocked",
      targetView: "cockpit",
      targetPanel: "season-review",
    },
    {
      id: "next-season",
      label: "Neue Saison vorbereiten",
      detail: "Sponsor, Training und Kader für S+1 prüfen.",
      status: seasonReviewReady ? "open" : "blocked",
      targetView: "cockpit",
      targetPanel: "preseason-workflow",
    },
  ];
}

function buildPreseasonItems(gameState: GameState, teamId: string): SeasonReadinessItem[] {
  const rosterCount = rosterPlayerIds(gameState, teamId).length;
  const sponsorContract = getTeamSponsorContract(gameState, teamId);
  const newGameFlow = gameState.seasonState.newGameFlow;
  const sponsorStep = newGameFlow?.steps?.find((step) => step.stepId === "choose_sponsor");
  const sponsorOpen = sponsorStep?.status === "open" || sponsorStep == null;

  return [
    {
      id: "sponsor",
      label: "Sponsor wählen",
      detail: sponsorContract ? "Sponsor-Vertrag aktiv." : "Angebot auswählen oder bestätigen.",
      status: sponsorContract ? "ready" : sponsorOpen ? "open" : "ready",
      targetView: "prize",
      targetPanel: "team-sponsor-choice",
    },
    {
      id: "roster",
      label: "Kader komplett",
      detail: rosterCount >= 7 ? `${rosterCount} Spieler im Kader.` : "Mindestens 7 Spieler für den Spieltag nötig.",
      status: rosterCount >= 7 ? "ready" : rosterCount > 0 ? "open" : "blocked",
      targetView: "marketV2",
    },
    {
      id: "training",
      label: "Training vorbereiten",
      detail: teamTrainingComplete(gameState, teamId)
        ? "Trainingsmodi gesetzt."
        : "Trainingsmodus für alle Spieler setzen.",
      status: teamTrainingComplete(gameState, teamId) ? "ready" : rosterCount > 0 ? "open" : "blocked",
      targetView: "trainingCompact",
    },
    {
      id: "facilities",
      label: "Facilities prüfen",
      detail: "Gebäude und Scouting für die neue Saison checken.",
      status: "open",
      targetView: "trainingV2",
      targetPanel: "facilities",
    },
  ];
}

export function buildSeasonReadinessChecklist(input: {
  gameState: GameState;
  teamId: string | null;
}): SeasonReadinessChecklist | null {
  if (!input.teamId) {
    return null;
  }

  const phase =
    input.gameState.gamePhase === "season_completed" || input.gameState.gamePhase === "season_review"
      ? "season_end"
      : input.gameState.gamePhase && input.gameState.gamePhase !== "season_active"
        ? "preseason"
        : "season_active";

  const items =
    phase === "season_end"
      ? buildSeasonEndItems(input.gameState)
      : phase === "preseason"
        ? buildPreseasonItems(input.gameState, input.teamId)
        : buildSeasonActiveItems(input.gameState, input.teamId);

  const readyCount = items.filter((item) => item.status === "ready").length;

  return {
    phase,
    title:
      phase === "season_end"
        ? "Saisonende-Assistent"
        : phase === "preseason"
          ? "Preseason-Checklist"
          : "Spieltag-Readiness",
    items,
    readyCount,
    totalCount: items.length,
  };
}
