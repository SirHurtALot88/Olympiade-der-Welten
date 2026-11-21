/**
 * KI-MERKLISTE, LESESEITE (21.11.): alles, was Anzeige und Postfach brauchen, ohne die Kaderplanung zu laden
 * (`lib/ai/ki-merkliste.ts` rechnet und haengt an `organic-squad`; diese Datei ist leicht und darf in Client-Bundles).
 */
import type { GameState, KiMerklisteEintrag, KiMerklisteStufe } from "@/lib/data/olyDataTypes";

/**
 * TECHNISCHE Obergrenze je KI-Team (Runde 2, 21.11.: es gibt KEIN fachliches Listen-Limit, wie beim Menschen). Sie haelt nur den
 * Speicher in Grenzen (32 Teams x Eintraege im Spielstand) und liegt deutlich ueber dem, was die Kaufbewertung je Team ergibt
 * (Messung in `docs/design/ki-merkliste-21-11.md`, Runde 2). Begrenzt ist das SCOUTING, nicht die Liste.
 */
export const KI_MERKLISTE_TECHNIK_MAX = 400;

/** Stufen nach dem Vorsprung relativ zum besten Kandidaten des Teams. */
export const KI_MERKLISTE_STUFEN_AB: ReadonlyArray<{ stufe: KiMerklisteStufe; anteil: number }> = [
  { stufe: 3, anteil: 0.85 },
  { stufe: 2, anteil: 0.65 },
  { stufe: 1, anteil: 0 },
];

export const KI_MERKLISTE_STUFE_WORT: Record<KiMerklisteStufe, string> = {
  1: "beobachtet",
  2: "interessiert",
  3: "Wunschziel",
};

/**
 * Die KI-Merkliste eines Teams als Eintraege, gelesen aus DEMSELBEN Speicher wie die Wunschliste des Menschen
 * (`seasonState.transferWishlist`, Eintraege mit `ki`). Fuer ein Team, das dort noch nichts hat, springt die Lese-Huelle fuer
 * Spielstaende aus Runde 1 ein (`seasonState.kiMerkliste`).
 */
export function kiMerklisteFuerTeam(gameState: Pick<GameState, "seasonState">, teamId: string): KiMerklisteEintrag[] {
  const aus: KiMerklisteEintrag[] = [];
  for (const zeile of gameState.seasonState.transferWishlist ?? []) {
    if (zeile.ki && zeile.teamId === teamId) aus.push({ playerId: zeile.playerId, ...zeile.ki });
  }
  if (aus.length > 0) return aus;
  return gameState.seasonState.kiMerkliste?.[teamId] ?? [];
}

/** Gibt es im Spielstand irgendeine KI-Merkliste (neu oder als Lese-Huelle)? */
export function hatKiMerkliste(gameState: Pick<GameState, "seasonState">): boolean {
  if (gameState.seasonState.kiMerkliste && Object.keys(gameState.seasonState.kiMerkliste).length > 0) return true;
  return (gameState.seasonState.transferWishlist ?? []).some((zeile) => zeile.ki);
}

/** Spieler, die ein Team NUR ueber die KI-Merkliste im Blick hat (nicht der Mensch, nicht per Hand). */
export function kiMerklisteSpielerIds(gameState: Pick<GameState, "seasonState">, teamId: string): Set<string> {
  return new Set(kiMerklisteFuerTeam(gameState, teamId).map((eintrag) => eintrag.playerId));
}

/** Welche KI-Teams haben diesen Spieler auf der Liste? Hoechste Stufe zuerst, dann Team-Kennung. */
export function kiInteresseAnSpieler(
  gameState: Pick<GameState, "seasonState">,
  playerId: string,
): Array<{ teamId: string; eintrag: KiMerklisteEintrag }> {
  const treffer = new Map<string, { teamId: string; eintrag: KiMerklisteEintrag }>();
  const mitNeuerListe = new Set<string>();
  for (const zeile of gameState.seasonState.transferWishlist ?? []) {
    if (!zeile.ki || !zeile.teamId) continue;
    mitNeuerListe.add(zeile.teamId);
    if (zeile.playerId === playerId) treffer.set(zeile.teamId, { teamId: zeile.teamId, eintrag: { playerId, ...zeile.ki } });
  }
  for (const [teamId, liste] of Object.entries(gameState.seasonState.kiMerkliste ?? {})) {
    if (mitNeuerListe.has(teamId)) continue;
    const eintrag = liste.find((zeile) => zeile.playerId === playerId);
    if (eintrag) treffer.set(teamId, { teamId, eintrag });
  }
  return [...treffer.values()].sort((a, b) => b.eintrag.stufe - a.eintrag.stufe || (a.teamId < b.teamId ? -1 : 1));
}

/** Der Grund in einem Satz: welche Disziplin, wie gut das Team dort schon besetzt ist. Nennt keine Werte des Spielers. */
export function kiMerklisteGrund(gameState: Pick<GameState, "disciplines">, eintrag: KiMerklisteEintrag): string {
  const name = eintrag.disziplinId ? gameState.disciplines?.find((d) => d.id === eintrag.disziplinId)?.name : null;
  if (!name) return "passt zur Kaderplanung";
  if (eintrag.abgedeckt <= 0) return `sucht Verstärkung in ${name} (dort noch niemand solide)`;
  if (eintrag.abgedeckt === 1) return `sucht Verstärkung in ${name} (erst ein solider Spieler)`;
  return `will in ${name} nachlegen (${eintrag.abgedeckt} solide Spieler)`;
}
