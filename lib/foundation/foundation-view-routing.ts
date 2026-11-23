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
  "seasonArchive",
  "cockpit",
  "inbox",
  "seasonPreview",
  "lineup",
  "lineupV2",
  "matchdayArena",
  "disciplineStage",
  "matchdayResult",
  "nachDemSpieltag",
  "teams",
  "training",
  "trainingCompact",
  "trainingV2",
  "players",
  "playerProfile",
  "teamProfile",
  "ranks",
  "diszis",
  "leagueLeaders",
  "allTimeTable",
  "prize",
  "market",
  "marketV2",
  "history",
  "debug",
  "generator",
  "teamSettings",
  "encyclopedia",
  "admin",
  "credits",
  "finances",
  "marketing",
  "ausruestung",
  "changelog",
  "battleArena",
] as const;

export type FoundationViewId = (typeof FOUNDATION_VIEW_IDS)[number];

/**
 * Die Merkliste ist seit 22.11. ein Reiter der Scouting-Seite (Chris: "nicht einzeln in der Navigation, sondern ein Teil von
 * Scouting mit eigenem Reiter"). Alte Links `view=merkliste` landen deshalb auf Scouting; dieser Marker sagt, dass dort der
 * Reiter "Merkliste" aktiv sein soll.
 */
export const SCOUTING_MERKLISTE_TAB = "merkliste" as const;

export function istAlterMerklisteLink(view: string | null | undefined): boolean {
  return view === "merkliste" || view === "watchlist" || view === "lesezeichen";
}

export function normalizeFoundationViewParam(view: string | null | undefined): FoundationViewId | null {
  if (!view) {
    return null;
  }

  if (istAlterMerklisteLink(view)) {
    return "scoutingCenterV2";
  }

  if (view === "lineup-v2" || view === "lineupV2" || view === "einsatzliste-v2") {
    return "lineup";
  }
  if (view === "matchday-arena" || view === "matchday-arena-v2") {
    return "matchdayArena";
  }
  if (view === "nach-dem-spieltag" || view === "nachdemspieltag") {
    return "nachDemSpieltag";
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
  if (view === "saison-archiv" || view === "archiv" || view === "historie" || view === "season-archive") {
    return "seasonArchive";
  }
  if (view === "history-v2" || view === "transferhistorie-v2" || view === "history") {
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
  if (
    view === "league-leaders" ||
    view === "league-leaders-v2" ||
    view === "leagueLeaders" ||
    view === "bestenliste" ||
    view === "leaders"
  ) {
    return "leagueLeaders";
  }
  if (view === "home-v2" || view === "homev2" || view === "home") {
    return "homeV2";
  }
  if (view === "ewige-tabelle" || view === "all-time-table" || view === "alltime") {
    return "allTimeTable";
  }
  if (view === "kredite" || view === "credit" || view === "loans" || view === "credits-v2") {
    return "credits";
  }
  if (view === "finanzen" || view === "finance" || view === "finances-v2") {
    return "finances";
  }
  if (view === "marketing" || view === "werbung") {
    return "marketing";
  }
  if (view === "ausruestung" || view === "ausrüstung" || view === "equipment" || view === "lager" || view === "kiste") {
    return "ausruestung";
  }
  if (view === "was-ist-neu" || view === "patchnotes" || view === "patch-notes") {
    return "changelog";
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
  if (view === "hq" || view === "home") return "homeV2";
  if (view === "player" || view === "player-profile" || view === "playerProfile") {
    return "playerProfile";
  }
  if (view === "team" || view === "team-profile" || view === "teamProfile") {
    return "teamProfile";
  }

  return FOUNDATION_VIEW_IDS.includes(view as FoundationViewId) ? (view as FoundationViewId) : null;
}

export function getDefaultFoundationViewTarget(view: FoundationViewId): FoundationViewId {
  if (view === "hq") return "homeV2";
  if (view === "home") return "homeV2";
  if (view === "market") return "marketV2";
  if (view === "history") return "historyV2";
  if (view === "season") return "seasonV2";
  if (view === "training") return "trainingCompact";
  if (view === "facilitiesOverviewV2") return "trainingV2";
  if (view === "inbox") return "inboxV2";
  if (view === "lineupV2") return "lineup";
  return view;
}
