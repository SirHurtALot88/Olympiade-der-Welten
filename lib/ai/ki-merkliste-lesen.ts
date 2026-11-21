/**
 * KI-MERKLISTE, LESESEITE (21.11.): alles, was Anzeige und Postfach brauchen, ohne die Kaderplanung zu laden
 * (`lib/ai/ki-merkliste.ts` rechnet und haengt an `organic-squad`; diese Datei ist leicht und darf in Client-Bundles).
 */
import type { GameState, KiMerklisteEintrag, KiMerklisteStufe } from "@/lib/data/olyDataTypes";

/** Hoechstzahl Eintraege je KI-Team. */
export const KI_MERKLISTE_MAX = 6;

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

/** Welche KI-Teams haben diesen Spieler auf der Liste? Hoechste Stufe zuerst, dann Team-Kennung. */
export function kiInteresseAnSpieler(
  gameState: Pick<GameState, "seasonState">,
  playerId: string,
): Array<{ teamId: string; eintrag: KiMerklisteEintrag }> {
  const treffer: Array<{ teamId: string; eintrag: KiMerklisteEintrag }> = [];
  for (const [teamId, liste] of Object.entries(gameState.seasonState.kiMerkliste ?? {})) {
    const eintrag = liste.find((zeile) => zeile.playerId === playerId);
    if (eintrag) treffer.push({ teamId, eintrag });
  }
  return treffer.sort((a, b) => b.eintrag.stufe - a.eintrag.stufe || (a.teamId < b.teamId ? -1 : 1));
}

/** Der Grund in einem Satz: welche Disziplin, wie gut das Team dort schon besetzt ist. Nennt keine Werte des Spielers. */
export function kiMerklisteGrund(gameState: Pick<GameState, "disciplines">, eintrag: KiMerklisteEintrag): string {
  const name = eintrag.disziplinId ? gameState.disciplines?.find((d) => d.id === eintrag.disziplinId)?.name : null;
  if (!name) return "passt zur Kaderplanung";
  if (eintrag.abgedeckt <= 0) return `sucht Verstärkung in ${name} (dort noch niemand solide)`;
  if (eintrag.abgedeckt === 1) return `sucht Verstärkung in ${name} (erst ein solider Spieler)`;
  return `will in ${name} nachlegen (${eintrag.abgedeckt} solide Spieler)`;
}
