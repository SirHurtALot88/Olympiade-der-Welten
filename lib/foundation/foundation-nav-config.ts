import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type FoundationNavItem = {
  id: FoundationViewId;
  label: string;
  tooltip: string;
  icon?: string;
};

export type FoundationNavGroup = {
  id: "matchday" | "team" | "market" | "world" | "admin";
  label: string;
  items: FoundationNavItem[];
};

export const FOUNDATION_NAV_GROUPS: FoundationNavGroup[] = [
  {
    id: "matchday",
    label: "Spieltag",
    items: [
      { id: "homeV2", label: "Home", tooltip: "Manager-Dashboard mit KPIs, Top-Spielern und Flow.", icon: "⌂" },
      { id: "inboxV2", label: "Inbox", tooltip: "Offene Aufgaben & Warnungen für dein Team.", icon: "✉" },
      { id: "lineup", label: "Einsatzliste", tooltip: "Spieler setzen, Formplan und Team-Taktik — Focus Mode.", icon: "▣" },
      { id: "matchdayArena", label: "Arena", tooltip: "Spieltag als Reveal/Event.", icon: "◉" },
      { id: "seasonV2", label: "Saisonstand", tooltip: "Tabelle, Cards und Teamstärken.", icon: "▤" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "teams", label: "Teams", tooltip: "Kader, Verträge und Teamdetails.", icon: "◈" },
      { id: "players", label: "Spieler", tooltip: "Spieler suchen und Profil öffnen.", icon: "◎" },
      { id: "trainingCompact", label: "Training", tooltip: "Trainingssteuerung pro Spieler.", icon: "↑" },
      { id: "trainingV2", label: "Gebäude", tooltip: "Facilities, Upgrade und Wirkung.", icon: "▦" },
    ],
  },
  {
    id: "market",
    label: "Markt",
    items: [
      { id: "marketV2", label: "Transfermarkt", tooltip: "Kaufen, verkaufen und verhandeln.", icon: "⇄" },
      { id: "scoutingCenterV2", label: "Scouting", tooltip: "Reports, Watchlist und Empfehlungen.", icon: "◐" },
      { id: "historyV2", label: "Historie", tooltip: "Vergangene Transfers.", icon: "↺" },
    ],
  },
  {
    id: "world",
    label: "Welt",
    items: [
      { id: "ranks", label: "Ranks", tooltip: "Team- und Disziplinranks.", icon: "▥" },
      { id: "diszis", label: "Diszis", tooltip: "Disziplinen und Mutatoren.", icon: "◫" },
      { id: "prize", label: "Sponsoren", tooltip: "Sponsor-Vertrag wählen und Saisonfinanzen prüfen.", icon: "€" },
      { id: "encyclopedia", label: "Lexikon", tooltip: "Spielbegriffe und Regeln.", icon: "?" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { id: "cockpit", label: "Spieltag", tooltip: "Spieltag steuern.", icon: "⏵" },
      { id: "generator", label: "Generator", tooltip: "Spieler generieren.", icon: "+" },
      { id: "teamSettings", label: "Settings", tooltip: "Team-Konfiguration.", icon: "⚙" },
      { id: "admin", label: "Admin", tooltip: "Technische Steuerung.", icon: "⚒" },
    ],
  },
];

export function isFoundationNavViewActive(activeView: FoundationViewId, itemId: FoundationViewId) {
  if (itemId === activeView) return true;
  if (itemId === "homeV2" && activeView === "home") return true;
  if (itemId === "seasonV2" && activeView === "season") return true;
  if (itemId === "marketV2" && activeView === "market") return true;
  if (itemId === "historyV2" && activeView === "history") return true;
  if (itemId === "inboxV2" && activeView === "inbox") return true;
  if (itemId === "lineup" && (activeView === "lineup" || activeView === "lineupV2")) return true;
  if (itemId === "players" && (activeView === "players" || activeView === "playerProfile")) return true;
  if (itemId === "teams" && (activeView === "teams" || activeView === "teamProfile")) return true;
  return false;
}
