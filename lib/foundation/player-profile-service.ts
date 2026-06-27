export {
  buildPlayerDrawerDataFromGameState,
  buildPlayerDrawerDataFromLegacyContext,
  type PlayerDetailDrawerData,
} from "@/lib/foundation/player-detail-drawer";

export type PlayerProfileTabId = "overview" | "details" | "contract" | "training" | "report" | "career";

export const PLAYER_PROFILE_TABS: Array<{ id: PlayerProfileTabId; label: string }> = [
  { id: "overview", label: "Stats" },
  { id: "details", label: "Details" },
  { id: "contract", label: "Vertrag" },
  { id: "training", label: "Entwicklung" },
  { id: "report", label: "Report" },
  { id: "career", label: "Karriere" },
];

export const PLAYER_PROFILE_TAB_ANCHORS: Record<PlayerProfileTabId, string> = {
  overview: "player-drawer-profile",
  details: "player-drawer-axis",
  contract: "player-drawer-market",
  training: "player-drawer-training-controls",
  report: "player-drawer-disciplines",
  career: "player-drawer-history",
};
