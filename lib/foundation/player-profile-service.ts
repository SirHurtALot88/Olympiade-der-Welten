export {
  buildPlayerDrawerDataFromGameState,
  buildPlayerDrawerDataFromLegacyContext,
  type PlayerDetailDrawerData,
} from "@/lib/foundation/player-detail-drawer";

/**
 * Die sechs Reiter des neuen Spielerprofils (18.11.): je ein Bildschirm ohne Scrollen. Der Reiter „Report“ (Scouting) ist
 * entfallen (Chris 18.11.): bei fremden, nicht voll gescouteten Spielern zeigt jede Tafel nur grobe Bereiche.
 * Die Ids bleiben die alten, wo es sie gab (`overview`, `contract`, `career`), damit URLs weiter tragen.
 */
export type PlayerProfileTabId = "overview" | "disciplines" | "performance" | "development" | "contract" | "career";

export const PLAYER_PROFILE_TABS: Array<{ id: PlayerProfileTabId; label: string }> = [
  { id: "overview", label: "Überblick" },
  { id: "disciplines", label: "Disziplinen" },
  { id: "performance", label: "Leistung" },
  { id: "development", label: "Entwicklung" },
  { id: "contract", label: "Vertrag" },
  { id: "career", label: "Karriere" },
];

const ALTE_REITER: Record<string, PlayerProfileTabId> = {
  details: "disciplines",
  training: "development",
  report: "overview",
};

/** Liest einen Reiter aus der URL; alte Namen (details, training, report) führen auf den passenden neuen. */
export function normalisierePlayerProfileTab(roh: string | null | undefined): PlayerProfileTabId {
  if (!roh) return "overview";
  if (PLAYER_PROFILE_TABS.some((tab) => tab.id === roh)) return roh as PlayerProfileTabId;
  return ALTE_REITER[roh] ?? "overview";
}
