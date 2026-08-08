/**
 * GEMELDET: „was hier noch falsch verknüpft ist bei den verkäufen ist der benchmark verkäufe aus
 * S1 am ende! daher müssten alle teams auch schon verkäufe haben" — auf dem Transferboard stand
 * bei JEDEM Team „Einnahmen 0,0 Mio", obwohl 20 Teams verkauft hatten.
 *
 * BEFUND, am Live-Spielstand ausgezaehlt: die Verkaeufe fehlten nicht, sie hingen an der anderen
 * Saison. Der Saisonuebergang traegt die Verkaeufe mit der ENDENDEN Saison ein und die Kaeufe des
 * neuen Fensters mit der NEUEN:
 *
 *     329  season-1  buy   md=matchday-1           Erst-Draft, Saisonstart
 *      47  season-1  sell  md=matchday-10          Verkaeufe am Saisonende
 *       2  season-1  sell  md=matchday-10          manuelle, gleiches Fenster
 *      69  season-2  buy   md=season-2-matchday-1
 *      33  season-2  buy   md=season-2-matchday-1
 *
 * Es ist EIN Transferfenster: verkauft am letzten Spieltag der alten Saison, gekauft am ersten der
 * neuen — und bezahlt wurden die Kaeufe aus genau diesen Verkaeufen. Das Board gruppierte nach
 * Saison und zerschnitt es. In der Saison-2-Ansicht standen darum nur Ausgaben.
 *
 * DIE REGEL: ein Eintrag des Transferfensters, der am LETZTEN Spieltag einer Saison liegt, gehoert
 * zum Fenster der FOLGENDEN Saison. Alles andere bleibt, wo es ist.
 *
 * Absichtlich eng gezogen:
 * - Nur `phase === "manual_transfer_window"`. Die 54 `contract_exit`-Eintraege liegen zwar
 *   ebenfalls auf dem letzten Spieltag, tragen aber `phase: "contract_renewal"` — auslaufende
 *   Vertraege sind kein Transfer und erzeugen keine Einnahme. Sie bleiben bei ihrer Saison.
 * - „Letzter Spieltag" wird aus den Eintraegen selbst bestimmt, nicht aus dem Spielplan: der
 *   `seasonState.schedule` kennt nur die LAUFENDE Saison, fuer vergangene gibt es ihn nicht mehr.
 *
 * NICHTS WIRD UMGESCHRIEBEN. Die Historie im Spielstand bleibt, wie sie ist — `seasonId` sagt
 * weiterhin wahrheitsgemaess, wann etwas passiert ist. Diese Zuordnung ist reine Anzeige.
 */

/** Das Noetigste, um einen Eintrag einzuordnen — bewusst schmal, damit jeder Aufrufer passt. */
export type TransferFensterEintrag = {
  seasonId: string;
  matchdayId?: string | null;
  phase?: string | null;
};

const TRANSFERFENSTER_PHASE = "manual_transfer_window";

/**
 * Die Nummer aus einer Spieltags-ID — `matchday-10` und `season-2-matchday-10` ergeben beide 10.
 * Gibt `null` zurueck, wenn keine Zahl drinsteht; solche Eintraege zaehlen nie als Saisonende.
 */
export function spieltagNummer(matchdayId: string | null | undefined): number | null {
  if (!matchdayId) return null;
  const treffer = /matchday-(\d+)/.exec(matchdayId);
  if (!treffer) return null;
  const nummer = Number(treffer[1]);
  return Number.isFinite(nummer) ? nummer : null;
}

/** Die Saisonnummer aus einer Saison-ID (`season-2` → 2). */
export function saisonNummer(seasonId: string | null | undefined): number | null {
  if (!seasonId) return null;
  const treffer = /(\d+)/.exec(seasonId);
  if (!treffer) return null;
  const nummer = Number(treffer[1]);
  return Number.isFinite(nummer) ? nummer : null;
}

/**
 * Der hoechste Spieltag, den eine Saison in dieser Historie ueberhaupt erreicht — die Grenze,
 * ab der ein Transfer als Abschluss der Saison gilt.
 */
export function ermittleLetzteSpieltageJeSaison(
  eintraege: readonly TransferFensterEintrag[],
): Map<string, number> {
  const hoechster = new Map<string, number>();
  for (const eintrag of eintraege) {
    const nummer = spieltagNummer(eintrag.matchdayId);
    if (nummer == null) continue;
    const bisher = hoechster.get(eintrag.seasonId);
    if (bisher == null || nummer > bisher) hoechster.set(eintrag.seasonId, nummer);
  }
  return hoechster;
}

/**
 * Die Saison, unter der ein Eintrag ANGEZEIGT wird. In aller Regel seine eigene; nur die
 * Abschluss-Transfers einer Saison wandern eine weiter.
 */
export function ermittleFensterSaisonId(
  eintrag: TransferFensterEintrag,
  letzteSpieltage: Map<string, number>,
  spieltageProSaison?: number | null,
): string {
  if ((eintrag.phase ?? null) !== TRANSFERFENSTER_PHASE) return eintrag.seasonId;

  const letzter = letzteSpieltage.get(eintrag.seasonId);
  const nummer = spieltagNummer(eintrag.matchdayId);
  if (letzter == null || nummer == null || nummer < letzter) return eintrag.seasonId;

  /**
   * UNTERGRENZE GEGEN TEILSEITEN. Die Transferliste wird seitenweise geladen; „hoechster
   * vorkommender Spieltag" ist damit nur so gut wie das, was gerade da ist. Bei einer Teilseite,
   * die bei Spieltag 4 endet, gaelten sonst Transfers vom vierten Spieltag als Saisonabschluss und
   * wanderten faelschlich eine Saison weiter.
   *
   * Ist die Zahl der Spieltage bekannt (aus dem Spielplan der laufenden Saison — die Liga spielt
   * in jeder Saison gleich viele), muss ein Abschluss-Transfer sie auch erreichen.
   */
  if (spieltageProSaison != null && spieltageProSaison > 0 && nummer < spieltageProSaison) {
    return eintrag.seasonId;
  }

  /**
   * Eine Saison, deren einzige Transfers am ERSTEN Spieltag liegen, hat kein Abschlussfenster —
   * sonst schoebe man den Erst-Draft aus Saison 1 nach Saison 2. Am echten Spielstand ist das der
   * Fall, der es beinahe kaputt gemacht haette: dort liegen 329 Draft-Kaeufe auf `matchday-1`, und
   * waere `matchday-1` zugleich der hoechste Spieltag, waeren sie alle mitgewandert.
   */
  if (letzter <= 1) return eintrag.seasonId;

  const saison = saisonNummer(eintrag.seasonId);
  if (saison == null) return eintrag.seasonId;
  return `season-${saison + 1}`;
}

/** Alle Eintraege auf einmal — spart jedem Aufrufer das Vorberechnen der letzten Spieltage. */
export function ordneNachTransferfenster<T extends TransferFensterEintrag>(
  eintraege: readonly T[],
  spieltageProSaison?: number | null,
): Map<T, string> {
  const letzteSpieltage = ermittleLetzteSpieltageJeSaison(eintraege);
  const zuordnung = new Map<T, string>();
  for (const eintrag of eintraege) {
    zuordnung.set(eintrag, ermittleFensterSaisonId(eintrag, letzteSpieltage, spieltageProSaison));
  }
  return zuordnung;
}
