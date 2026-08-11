/**
 * DISZIPLIN-BILANZ EINER SAISON — je Team die Kennzahlen, die aus `disciplineResults` entstehen.
 *
 * Herausgeloest aus `league-achievements-extended`, damit dieselbe Rechnung an zwei Datenlagen
 * laufen kann: serverseitig auf dem VOLLEN Spielstand (als Projektion, siehe
 * `lib/persistence/foundation-discipline-tally-projection.ts`) und clientseitig als Rueckfall.
 * Ein Resolver, zwei Datenlagen — kein zweiter Rechenweg, der auseinanderlaufen koennte.
 *
 * Bewusst NUR Rohmasse (Siege, laengste Serie, Anzahl Bereiche), keine Schwellen. Ob „drei
 * Spieltage in Folge" reicht, entscheidet weiterhin allein der Meilenstein-Katalog.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export type SeasonDisciplineTallyEntry = {
  teamId: string;
  /** Disziplinsiege (Rang 1) in der Saison. */
  siege: number;
  /** Meiste Siege an EINEM Spieltag — 2 heisst „beide Disziplinen desselben Spieltags". */
  bestesSpieltagsDoppel: number;
  /** Meiste Siege in EINER Disziplin. */
  besteDisziplinSiege: number;
  /** Die Disziplin dazu — fuer die Beschriftung. */
  besteDisziplinId: string | null;
  /** Wie viele der vier Bereiche mindestens eine Top-5-Platzierung tragen. */
  bereicheMitTop5: number;
  /** Laengste Folge aufeinanderfolgender Spieltage mit mindestens einer Top-3-Platzierung. */
  top3Serie: number;
};

export type SeasonDisciplineTallyByTeamId = Map<string, SeasonDisciplineTallyEntry>;

/** Spieltags-Nummer aus `md-7` — fuer Serien braucht es die REIHENFOLGE, nicht nur die Menge. */
export function spieltagNummerAusId(matchdayId: string): number {
  const treffer = matchdayId.match(/(\d+)$/);
  return treffer ? Number(treffer[1]) : 0;
}

/** Laengste Folge aufeinanderfolgender Spieltage in einer Menge von Spieltags-Nummern. */
export function laengsteSpieltagsSerie(nummern: number[]): number {
  const sortiert = [...new Set(nummern)].sort((links, rechts) => links - rechts);
  let beste = 0;
  let laufend = 0;
  let vorher: number | null = null;
  for (const nummer of sortiert) {
    laufend = vorher != null && nummer === vorher + 1 ? laufend + 1 : 1;
    vorher = nummer;
    if (laufend > beste) beste = laufend;
  }
  return beste;
}

/**
 * Wie viele Spieltage der laufenden Saison im vorliegenden Stand ueberhaupt mit
 * Disziplin-Ergebnissen belegt sind.
 *
 * Das ist das Mass, an dem die Leser den Vorrang entscheiden: der kompakte Browser-Payload
 * traegt genau EINEN belegten Spieltag, der volle Spielstand alle. Gezaehlt wird die
 * ABDECKUNG, nicht `matchdayResults` — die faehrt vollstaendig mit und wuerde beide Faelle
 * gleich aussehen lassen.
 */
export function zaehleBelegteSpieltage(gameState: GameState, seasonId: string = gameState.season.id): number {
  const saisonResultIds = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === seasonId)
      .map((result) => [result.id, result.matchdayId] as const),
  );
  const belegte = new Set<string>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    const matchdayId = saisonResultIds.get(result.matchdayResultId);
    if (matchdayId) belegte.add(matchdayId);
  }
  return belegte.size;
}

export function buildSeasonDisciplineTallyByTeamId(
  gameState: GameState,
  seasonId: string = gameState.season.id,
): SeasonDisciplineTallyByTeamId {
  const saisonResultIds = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === seasonId)
      .map((result) => [result.id, result.matchdayId] as const),
  );
  const disziplinKategorie = new Map((gameState.disciplines ?? []).map((d) => [d.id, d.category] as const));

  type Zwischenstand = {
    siege: number;
    siegeJeSpieltag: Map<string, number>;
    siegeJeDisziplin: Map<string, number>;
    bereicheMitTop5: Set<string>;
    spieltageMitTop3: number[];
  };
  const zwischen = new Map<string, Zwischenstand>();
  const hole = (teamId: string) => {
    const vorhanden = zwischen.get(teamId);
    if (vorhanden) return vorhanden;
    const neu: Zwischenstand = {
      siege: 0,
      siegeJeSpieltag: new Map(),
      siegeJeDisziplin: new Map(),
      bereicheMitTop5: new Set(),
      spieltageMitTop3: [],
    };
    zwischen.set(teamId, neu);
    return neu;
  };

  for (const result of gameState.seasonState.disciplineResults ?? []) {
    const matchdayId = saisonResultIds.get(result.matchdayResultId);
    if (!matchdayId) continue;
    const stand = hole(result.teamId);
    const rang = result.rank ?? Number.POSITIVE_INFINITY;

    if (result.rank === 1) {
      stand.siege += 1;
      stand.siegeJeSpieltag.set(matchdayId, (stand.siegeJeSpieltag.get(matchdayId) ?? 0) + 1);
      stand.siegeJeDisziplin.set(result.disciplineId, (stand.siegeJeDisziplin.get(result.disciplineId) ?? 0) + 1);
    }
    if (rang <= 5) {
      const kategorie = disziplinKategorie.get(result.disciplineId);
      if (kategorie != null) stand.bereicheMitTop5.add(kategorie);
    }
    if (rang <= 3) {
      stand.spieltageMitTop3.push(spieltagNummerAusId(matchdayId));
    }
  }

  const bilanz: SeasonDisciplineTallyByTeamId = new Map();
  for (const [teamId, stand] of zwischen.entries()) {
    const besteDisziplin =
      [...stand.siegeJeDisziplin.entries()].sort((links, rechts) => rechts[1] - links[1])[0] ?? null;
    bilanz.set(teamId, {
      teamId,
      siege: stand.siege,
      bestesSpieltagsDoppel: Math.max(0, ...stand.siegeJeSpieltag.values()),
      besteDisziplinSiege: besteDisziplin?.[1] ?? 0,
      besteDisziplinId: besteDisziplin?.[0] ?? null,
      bereicheMitTop5: stand.bereicheMitTop5.size,
      top3Serie: laengsteSpieltagsSerie(stand.spieltageMitTop3),
    });
  }
  return bilanz;
}

/** Leerer Eintrag fuer ein Team ohne einen einzigen Disziplin-Auftritt. */
export function leereDisziplinBilanz(teamId: string): SeasonDisciplineTallyEntry {
  return {
    teamId,
    siege: 0,
    bestesSpieltagsDoppel: 0,
    besteDisziplinSiege: 0,
    besteDisziplinId: null,
    bereicheMitTop5: 0,
    top3Serie: 0,
  };
}
