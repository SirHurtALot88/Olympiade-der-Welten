import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type { SpielerSicht } from "@/lib/market/transfermarkt-sicht";

export type DraftZeile = { item: TransfermarktFreeAgentItem; sicht: SpielerSicht };

/** Was jede Teil-Ansicht der Draft-Seite braucht. Alles nur lesend; geschrieben wird über `aktionen`. */
export type DraftKontext = {
  ansicht: LigaDraftAnsicht;
  hintergrund: boolean;
  /** Freie Spieler des Bretts (Feed minus gebuchte Picks), mit Scouting-Sicht. */
  zeilen: DraftZeile[];
  zeilenById: Map<string, DraftZeile>;
  feedBusy: boolean;
  feedFehler: string | null;
  nebelAus: boolean;
  disziplin: string;
  setDisziplin: (id: string) => void;
  wappen: (teamId: string) => string | null;
  portrait: (playerId: string) => string | null;
  figur: (playerId: string) => string | null;
  teamName: (teamId: string) => string;
  teamKuerzel: (teamId: string) => string;
  /** Wunschliste (Spieler-Ids) und Umschalter aus dem Scouting. */
  wunsch: Set<string>;
  toggleWunsch: (item: DraftZeile["item"]) => void;
  wahl: string | null;
  setWahl: (playerId: string | null) => void;
  schau: string | null;
  setSchau: (teamId: string | null) => void;
};
