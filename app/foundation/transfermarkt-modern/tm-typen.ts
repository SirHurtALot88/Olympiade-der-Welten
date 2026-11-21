import type {
  Discipline,
  GameState,
  Team,
  TeamControlMode,
  TeamSeasonObjectiveRecord,
  TransferWishlistEntry,
} from "@/lib/data/olyDataTypes";
import type { ProfilHost } from "@/app/foundation/shared/GrossesProfil";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type { DisziplinBedarf } from "@/lib/market/transfermarkt-disziplin-bedarf";
import type { TransferFreigabe } from "@/lib/market/transfermarkt-freigabe";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

/** Eine Kaderzeile (alle Teams der Liga) mit den echten Eignungswerten — für Kaderstärke, Verkauf und Verträge. */
export type TransfermarktV2RosterRow = {
  activePlayerId: string;
  playerId: string;
  teamId: string;
  name: string;
  className: string;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  pps: number | null;
  ovr: number | null;
  mvs: number | null;
  race?: string | null;
  portraitUrl?: string | null;
  valueScore?: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  disciplineRatings?: Record<string, number | null>;
  known?: boolean;
  caStars?: number | null;
  poStarRange?: { min: number; max: number } | null;
  caScore?: number | null;
  poScoreRange?: { min: number; max: number } | null;
  previousSeasonAxis?: {
    seasonId: string;
    ppPow: number | null;
    ppSpe: number | null;
    ppMen: number | null;
    ppSoc: number | null;
    ppPowRank: number | null;
    ppSpeRank: number | null;
    ppMenRank: number | null;
    ppSocRank: number | null;
  } | null;
};

export type TransfermarktModernProps = {
  defaultSaveId: string;
  defaultSeasonId: string;
  bootstrapReady?: boolean;
  defaultTeamId?: string | null;
  source?: "sqlite" | "prisma";
  activeOwnerId?: string | null;
  manageableTeamIds?: string[];
  teamControlModesByTeamId?: Record<string, TeamControlMode>;
  teamControlOwnersByTeamId?: Record<string, { ownerId?: string | null; ownerSlot?: string | null }>;
  teams: Team[];
  disciplines?: Discipline[];
  disciplineRanksByTeamId?: Record<string, Record<string, number>>;
  leagueTeamCount?: number;
  /** Team-Ids der eigenen Liga (Rang wird nur gegen sie gerechnet). Fehlt es: alle Teams. */
  leagueTeamIds?: string[];
  /** Fog of War aus (Spielstand-Einstellung `scenarioMeta.scoutingNebelAus`): exakte Werte, Sortierung nach ihnen. */
  nebelAus?: boolean;
  /** Verletzte Spieler (nicht einsetzbar, zählen in der Kaderstärke nicht). */
  injuredPlayerIds?: string[];
  /** Vorstand-Freigabe (Datenvertrag `TransferFreigabe`); `null` = nicht vorhanden, dann zeigt die Seite nur den Kontostand. */
  freigabe?: TransferFreigabe | null;
  /** Wichtigkeit je Disziplin aus dem Spielplan (Vorkommen, Slots), siehe `baueDisziplinBedarf`. */
  disziplinBedarf?: DisziplinBedarf;
  rosterRows?: TransfermarktV2RosterRow[];
  playerRatingsById?: Map<
    string,
    { ovrRank?: number | null; ppsSeasonRank?: number | null; mvsRank?: number | null; ppsSeason?: number | null }
  >;
  wishlistEntries?: TransferWishlistEntry[];
  wishlistPlayerIds?: string[];
  boardObjectiveHighlights?: TeamSeasonObjectiveRecord[];
  /** Was das große Spielerprofil braucht (wie im Draft); fehlt es, fällt die Seite auf `onOpenPlayerDetails` zurück. */
  profilHost?: ProfilHost | null;
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
  onOpenHistory?: (() => void) | null;
  /** Heutiger Draft-Weg (Platzhalter-Reiter zeigt dorthin, bis der Draft-Neubau kommt). */
  onOpenDraft?: (() => void) | null;
  /**
   * Läuft gerade der Liga-Draft (geordnete Phase)? Dann wird am Markt nicht verhandelt (Chris 21.11.: „im Draft wird immer
   * 1 Jahr gepickt“) — gepickt wird auf der Draft-Seite zu Festkonditionen, der Verhandlungstisch bleibt zu.
   */
  ligaDraftLaeuft?: boolean;
  onToggleWishlist?: ((item: TransfermarktFreeAgentItem) => void) | null;
  onRemoveWishlist?: ((playerId: string) => void) | null;
  scoutingWatchPlayerIds?: string[];
  scoutingIntelByPlayerId?: Record<string, number>;
  scoutingPipelineCapacity?: { occupied: number; max: number | null; draftSuspended?: boolean } | null;
  scoutingActiveWishlistPlayerIds?: string[];
  scoutingCompletedWishlistPlayerIds?: string[];
  onToggleScoutingWatch?: ((item: TransfermarktFreeAgentItem) => void) | null;
  /** Nach einem echten Kauf: der vom Server berechnete Folgezustand (oder `null` → voller Reload). */
  onBuyCompleted?: ((payload: { teamId: string; gameStateAfter: GameState | null }) => Promise<void> | void) | null;
  /** Nach Verkauf bzw. Verlängerung: Spielstand und Markt-Feed neu laden. */
  onSellCompleted?: ((payload: { teamId: string }) => Promise<void> | void) | null;
  onRenewCompleted?: ((payload: { teamId: string }) => Promise<void> | void) | null;
  initialPlayerId?: string | null;
  onInitialPlayerFocusConsumed?: (() => void) | null;
  offerPanelActive?: boolean;
  onOpenOfferPanel?: (playerId: string) => void;
  /** Hält den Shell-Zustand (Hauptaktion) mit der Listenauswahl gleich. */
  onSelectCandidate?: (playerId: string, name: string) => void;
  onCloseOfferPanel?: () => void;
  onSell?: ((payload: { activePlayerId: string; playerId: string; playerName: string; className: string; race: string | null; portraitUrl: string | null }) => void) | null;
  roomContext?: FoundationRoomContext | null;
  /** Transferfenster-Status: ein gemeinsames Fenster für Kauf und Verkauf. */
  transferWindow?: { open: boolean; canBuy: boolean; canSell: boolean; phaseLabel: string };
};
