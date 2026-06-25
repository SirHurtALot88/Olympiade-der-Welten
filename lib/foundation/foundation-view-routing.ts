export const FOUNDATION_VIEW_IDS = [
  "home",
  "homeV2",
  "facilitiesOverviewV2",
  "scoutingCenterV2",
  "inboxV2",
  "hq",
  "season",
  "seasonV2",
  "historyV2",
  "cockpit",
  "inbox",
  "seasonPreview",
  "lineup",
  "matchdayArena",
  "matchdayResult",
  "teams",
  "training",
  "trainingCompact",
  "trainingV2",
  "players",
  "playerProfile",
  "ranks",
  "diszis",
  "prize",
  "market",
  "marketV2",
  "history",
  "debug",
  "generator",
  "teamSettings",
  "encyclopedia",
  "admin",
] as const;

export type FoundationViewId = (typeof FOUNDATION_VIEW_IDS)[number];

export function normalizeFoundationViewParam(view: string | null | undefined): FoundationViewId | null {
  if (!view) {
    return null;
  }

  if (view === "matchday-arena" || view === "matchday-arena-v2") {
    return "matchdayArena";
  }
  if (view === "season-v2" || view === "season") {
    return "seasonV2";
  }
  if (view === "prize-v2" || view === "preisgeld-v2") {
    return "prize";
  }
  if (view === "transfermarkt-v2" || view === "transfermarkt" || view === "market") {
    return "marketV2";
  }
  if (view === "history-v2" || view === "transferhistorie-v2") {
    return "historyV2";
  }
  if (view === "teams-v2") {
    return "teams";
  }
  if (view === "training-v2" || view === "training-facilities-v2" || view === "gebaeude-v2" || view === "facilities-v2") {
    return "trainingV2";
  }
  if (view === "training-compact" || view === "training" || view === "training-facilities") {
    return "trainingCompact";
  }
  if (view === "lexikon" || view === "glossar" || view === "encyclopedia" || view === "buch") {
    return "encyclopedia";
  }
  if (view === "home-v2" || view === "homev2") {
    return "homeV2";
  }
  if (view === "facilities-overview-v2" || view === "facilities-v2-overview") {
    return "facilitiesOverviewV2";
  }
  if (view === "scouting-center-v2" || view === "scouting-v2") {
    return "scoutingCenterV2";
  }
  if (view === "inbox-v2" || view === "inbox") {
    return "inboxV2";
  }
  if (view === "hq") return "homeV2";
  if (view === "player" || view === "player-profile" || view === "playerProfile") {
    return "playerProfile";
  }

  return FOUNDATION_VIEW_IDS.includes(view as FoundationViewId) ? (view as FoundationViewId) : null;
}

export function getDefaultFoundationViewTarget(view: FoundationViewId): FoundationViewId {
  if (view === "hq") return "homeV2";
  if (view === "home") return "homeV2";
  if (view === "market") return "marketV2";
  if (view === "season") return "seasonV2";
  if (view === "training") return "trainingCompact";
  if (view === "facilitiesOverviewV2") return "trainingV2";
  if (view === "inbox") return "inboxV2";
  return view;
}
