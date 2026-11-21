import type { LigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import type { DraftKaderZeile } from "./draft-liga";
import type { SpielerSicht } from "@/lib/market/transfermarkt-sicht";
import type { TeamVorbereitung } from "@/lib/market/transfermarkt-kaderstaerke";

/** Ein Spieler des eigenen Kaders (Spielstand plus Draft-Picks) mit seinen exakten Eignungen. */
export type DraftMeinKaderSpieler = { playerId: string; name: string; className: string; ratings: Record<string, number | null | undefined> | null | undefined };

export type DraftZeile = { item: TransfermarktFreeAgentItem; sicht: SpielerSicht };

/** Was jede Teil-Ansicht der Draft-Seite braucht. Alles nur lesend; geschrieben wird über `aktionen`. */
export type DraftKontext = {
  /** Spielstand-Id: Schlüssel für die gemerkten Filter des Draft-Bretts. */
  saveId: string;
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
  /** Öffnet das Spielerprofil (Kurzprofil-Drawer) über der Draft-Seite — verlässt den Draft nicht. */
  profil: (playerId: string) => void;
  spielerName: (playerId: string) => string;
  /** Kaderstärke je Disziplin mit Liga-Rang des eigenen Teams (live, `draft-liga.ts`); `null` ohne eigenes Team. */
  raenge: DraftKaderZeile[] | null;
  /** Eigene Spieler (inkl. Picks, die der Spielstand noch nicht kennt) für „Mein Kader in ⟨Disziplin⟩“. */
  meinKader: DraftMeinKaderSpieler[];
  /** Vorbereitete Kaderrechnung des eigenen Teams (live mit allen Picks) für „Wirkung auf deinen Kader“; `null` ohne eigenes Team. */
  vorbereitung: TeamVorbereitung | null;
  wahl: string | null;
  setWahl: (playerId: string | null) => void;
  /** Klickregel (UX 19.11.): 1. Klick wählt aus, Klick auf das Ausgewählte öffnet das Profil; Vergebenes öffnet sofort das Profil. */
  klick: (playerId: string) => void;
  /** Name = Abkürzung: wählt aus (wenn noch frei) und öffnet das Profil. */
  nameKlick: (playerId: string) => void;
  schau: string | null;
  setSchau: (teamId: string | null) => void;
};
