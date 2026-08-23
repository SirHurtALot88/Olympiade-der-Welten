import type { GameState, MerklisteArt, MerklisteEintrag } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";

/**
 * DIE MERKLISTE — Lesezeichen auf Teams und Spieler.
 *
 * GEWUENSCHT (Chris): „man sollte sich aussuchen können welche teams getrackt werden, dass man so
 * ne wishlist option bei teams und spielern hat wie so lesezeichen und sich die dann noch mal
 * angucken kann · binde das bei den teams ein dass in der Arena dann die angezeigt werden die ich
 * gewishlistet habe zusätzlich zu den menschlichen teams".
 *
 * Die Begruendung, warum das NICHT die Scouting-Beobachtungsliste ist, steht am Typ
 * `MerklisteEintrag` (olyDataTypes.ts). Kurz: die haengt an einer Saison, hat eine Platzgrenze und
 * wirft jeden Spieler raus, der in einem Kader steht.
 *
 * DREI REGELN, und jede loest ein konkretes Problem:
 *
 *   1. AM BESITZER. Im Koop fuehrt jeder seine eigene Liste. Ohne Anmeldung (Solo) ist `ownerId`
 *      null und es gibt genau einen Eimer — dieselbe Unterscheidung, die `resolveSessionOwnerId`
 *      ohnehin schon trifft.
 *   2. KEINE OBERGRENZE. Ein Lesezeichen kostet nichts. Die Platzgrenze gehoert ins Scouting, wo
 *      sie eine Ressource abbildet.
 *   3. IDEMPOTENT. Zweimal merken ist einmal merken, zweimal entfernen ist einmal entfernen. Der
 *      Knopf in der Oberflaeche ist ein Umschalter und darf nicht davon abhaengen, ob die Ansicht
 *      gerade den aktuellen Stand kennt.
 */

/**
 * EIN EIMER JE BESITZER — und „niemand" ist derselbe Eimer wie der Standardbesitzer.
 *
 * DER FEHLER, DEN DAS VERHINDERT, war beim Verdrahten schon angelegt: die Arena kennt den
 * Besitzer nur ueber den Raum (`roomContext?.ownerId`, im Solo also `null`), die Teamansicht ueber
 * `activeOwnerId` der Schale (im Solo `DEFAULT_ACTIVE_OWNER_ID`). Ohne diese Normalisierung waeren
 * das zwei getrennte Listen gewesen: ein in der Teamansicht gesetztes Lesezeichen waere in der
 * Arena nie aufgetaucht, und niemand haette gesehen, warum.
 *
 * Fachlich ist es ohnehin dasselbe: ohne Anmeldung spielt der Standardbesitzer. Zwei benannte
 * Besitzer bleiben getrennt, wie sie sollen.
 */
export function normalisiereMerklistenBesitzer(ownerId: string | null | undefined): string {
  const getrimmt = ownerId?.trim();
  return getrimmt ? getrimmt : DEFAULT_ACTIVE_OWNER_ID;
}

/** Alle Eintraege dieses Besitzers, neueste zuerst. */
export function leseMerkliste(gameState: GameState, ownerId: string | null): MerklisteEintrag[] {
  const besitzer = normalisiereMerklistenBesitzer(ownerId);
  return (gameState.merkliste ?? []).filter(
    (eintrag) => normalisiereMerklistenBesitzer(eintrag.ownerId) === besitzer,
  );
}

/** Die gemerkten IDs einer Art — als Menge, weil jede Ansicht damit nur nachschlaegt. */
export function leseGemerkteIds(gameState: GameState, ownerId: string | null, art: MerklisteArt): Set<string> {
  return new Set(leseMerkliste(gameState, ownerId).filter((eintrag) => eintrag.art === art).map((eintrag) => eintrag.id));
}

export function istGemerkt(gameState: GameState, input: { ownerId: string | null; art: MerklisteArt; id: string }): boolean {
  return leseMerkliste(gameState, input.ownerId).some(
    (eintrag) => eintrag.art === input.art && eintrag.id === input.id,
  );
}

/**
 * Setzt ein Lesezeichen. Ein bereits vorhandenes bleibt unveraendert stehen — insbesondere sein
 * `angelegtAm`, damit die Liste ihre Reihenfolge behaelt, wenn jemand zweimal klickt.
 */
export function merke(input: {
  gameState: GameState;
  ownerId: string | null;
  art: MerklisteArt;
  id: string;
  notiz?: string | null;
  jetzt?: string;
}): GameState {
  const id = input.id.trim();
  if (!id) {
    return input.gameState;
  }
  if (istGemerkt(input.gameState, { ownerId: input.ownerId, art: input.art, id })) {
    return input.gameState;
  }
  const eintrag: MerklisteEintrag = {
    art: input.art,
    id,
    ownerId: normalisiereMerklistenBesitzer(input.ownerId),
    angelegtAm: input.jetzt ?? new Date().toISOString(),
    ...(input.notiz != null ? { notiz: input.notiz } : {}),
  };
  return {
    ...input.gameState,
    merkliste: [eintrag, ...(input.gameState.merkliste ?? [])],
  };
}

/** Nimmt ein Lesezeichen weg. Ein nicht vorhandenes zu entfernen ist kein Fehler. */
export function vergiss(input: {
  gameState: GameState;
  ownerId: string | null;
  art: MerklisteArt;
  id: string;
}): GameState {
  const vorhanden = input.gameState.merkliste ?? [];
  const besitzer = normalisiereMerklistenBesitzer(input.ownerId);
  const uebrig = vorhanden.filter(
    (eintrag) =>
      !(
        normalisiereMerklistenBesitzer(eintrag.ownerId) === besitzer &&
        eintrag.art === input.art &&
        eintrag.id === input.id
      ),
  );
  if (uebrig.length === vorhanden.length) {
    return input.gameState;
  }
  return { ...input.gameState, merkliste: uebrig };
}

/** Umschalter fuer die Oberflaeche: merkt, wenn nicht gemerkt — und umgekehrt. */
export function schalteMerkliste(input: {
  gameState: GameState;
  ownerId: string | null;
  art: MerklisteArt;
  id: string;
  notiz?: string | null;
  jetzt?: string;
}): { gameState: GameState; gemerkt: boolean } {
  if (istGemerkt(input.gameState, { ownerId: input.ownerId, art: input.art, id: input.id })) {
    return { gameState: vergiss(input), gemerkt: false };
  }
  return { gameState: merke(input), gemerkt: true };
}

/**
 * DIE TEAMS, DIE IN DER ARENA ZUSAETZLICH GEZEIGT WERDEN.
 *
 * Chris' Vorgabe woertlich: die gemerkten „zusätzlich zu den menschlichen teams". Beides zusammen,
 * ohne Dubletten, und die eigenen Teams lassen sich nicht abwaehlen — sie sind keine Auswahl,
 * sondern der Ausgangspunkt.
 *
 * Die Reihenfolge macht der Aufrufer (in der Arena: nach Saisonrang). Hier steht nur, WER
 * dazugehoert — eine Menge, keine Liste, damit niemand sie versehentlich als Rangfolge liest.
 */
export function leseArenaTeamAuswahl(input: {
  gameState: GameState;
  ownerId: string | null;
  /** Von Menschen gefuehrte Teams — im Solo das eigene, im Koop alle Sitze beider Spieler. */
  menschlicheTeamIds: readonly string[];
}): Set<string> {
  const auswahl = new Set<string>();
  for (const teamId of input.menschlicheTeamIds) {
    if (teamId) auswahl.add(teamId);
  }
  for (const teamId of leseGemerkteIds(input.gameState, input.ownerId, "team")) {
    auswahl.add(teamId);
  }
  return auswahl;
}
