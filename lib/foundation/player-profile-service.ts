export {
  buildPlayerDrawerDataFromGameState,
  buildPlayerDrawerDataFromLegacyContext,
  type PlayerDetailDrawerData,
} from "@/lib/foundation/player-detail-drawer";

export type PlayerProfileTabId = "overview" | "details" | "contract" | "training" | "report" | "career";

export const PLAYER_PROFILE_TABS: Array<{ id: PlayerProfileTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "contract", label: "Contract" },
  { id: "training", label: "Training" },
  { id: "report", label: "Report" },
  { id: "career", label: "Career" },
];
