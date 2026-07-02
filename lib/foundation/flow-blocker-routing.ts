import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type FlowBlockerRoute = {
  targetView: FoundationViewId;
  targetPanel?: string | null;
  ctaLabel: string;
};

/** Playtest-checklist blocker IDs → direct UI fix path. */
export const PLAYTEST_BLOCKER_ROUTES: Record<string, FlowBlockerRoute> = {
  lineup_not_submitted: {
    targetView: "lineup",
    ctaLabel: "Lineup bestätigen",
  },
  missing_lineup: {
    targetView: "lineup",
    ctaLabel: "Lineup öffnen",
  },
  incomplete_lineup: {
    targetView: "lineup",
    ctaLabel: "Lineup vervollständigen",
  },
  missing_formcard_pool: {
    targetView: "lineup",
    targetPanel: "formcards",
    ctaLabel: "Formkarten erzeugen",
  },
  missing_formcard_selections: {
    targetView: "lineup",
    targetPanel: "formcards",
    ctaLabel: "Formkarten prüfen",
  },
  training_missing: {
    targetView: "trainingCompact",
    ctaLabel: "Training setzen",
  },
  board_objectives_failed: {
    targetView: "teams",
    targetPanel: "board-objectives",
    ctaLabel: "Board-Ziele prüfen",
  },
  board_objectives_at_risk: {
    targetView: "teams",
    targetPanel: "board-objectives",
    ctaLabel: "Board-Ziele prüfen",
  },
  high_board_pressure: {
    targetView: "teams",
    targetPanel: "board-objectives",
    ctaLabel: "Board-Druck prüfen",
  },
  "phase_blocked:buy_players:transfer_window_closed": {
    targetView: "marketV2",
    ctaLabel: "Transfermarkt prüfen",
  },
  transfer_window_closed: {
    targetView: "marketV2",
    ctaLabel: "Transferfenster prüfen",
  },
  "resolve_status:missing_lineups": {
    targetView: "cockpit",
    targetPanel: "resolve-lab",
    ctaLabel: "Resolve-Lab öffnen",
  },
  "resolve_status:incomplete_lineups": {
    targetView: "cockpit",
    targetPanel: "resolve-lab",
    ctaLabel: "Resolve-Lab öffnen",
  },
  prize_money_not_applied: {
    targetView: "prize",
    ctaLabel: "Preisgeld prüfen",
  },
  player_development_pending: {
    targetView: "cockpit",
    targetPanel: "season-review",
    ctaLabel: "Spielerentwicklung prüfen",
  },
  no_active_team: {
    targetView: "teamSettings",
    ctaLabel: "Team wählen",
  },
  empty_roster: {
    targetView: "marketV2",
    ctaLabel: "Kader aufbauen",
  },
};

const PLAYTEST_BLOCKER_IDS = [
  "lineup_not_submitted",
  "missing_lineup",
  "incomplete_lineup",
  "missing_formcard_pool",
  "training_missing",
  "phase_blocked:buy_players:transfer_window_closed",
  "resolve_status:missing_lineups",
  "board_objectives_failed",
] as const;

export const PLAYTEST_CHECKLIST_BLOCKER_IDS: readonly string[] = PLAYTEST_BLOCKER_IDS;

function normalizeBlockerId(blockerId: string) {
  if (PLAYTEST_BLOCKER_ROUTES[blockerId]) {
    return blockerId;
  }
  if (blockerId.startsWith("phase_blocked:buy_players:")) {
    return "phase_blocked:buy_players:transfer_window_closed";
  }
  if (blockerId.startsWith("resolve_status:")) {
    return blockerId;
  }
  return blockerId;
}

export function resolveFlowBlockerRoute(blockerId: string): FlowBlockerRoute | null {
  const normalized = normalizeBlockerId(blockerId);
  return PLAYTEST_BLOCKER_ROUTES[normalized] ?? null;
}

export function resolvePrimaryBlockerRoute(blockers: string[]): FlowBlockerRoute | null {
  for (const blocker of blockers) {
    const route = resolveFlowBlockerRoute(blocker);
    if (route) {
      return route;
    }
  }
  return null;
}

export function listPlaytestBlockersWithoutRoute() {
  return PLAYTEST_CHECKLIST_BLOCKER_IDS.filter((blockerId) => !resolveFlowBlockerRoute(blockerId));
}
