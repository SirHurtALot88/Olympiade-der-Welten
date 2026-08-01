/**
 * MOST IMPROVED PLAYER — die eine Rechnung hinter Bestenliste UND Saisonende-Auszeichnung.
 *
 * Beide Seiten (die Kategorie in `league-leaders-service` und der Award in
 * `season-review-service`) lesen `buildMostImprovedRows`. Zwei Stellen, die "am meisten
 * verbessert" verschieden ausrechnen, waeren garantiert irgendwann uneins — deshalb liegt die
 * Rangfolge hier und nur hier, fertig sortiert. Wer sie anzeigt, sortiert NICHT nach.
 *
 * WARUM PERFORMANCE-TREND UND NICHT ATTRIBUT-ZUWACHS
 *
 * Naheliegend waere "Zuwachs an Gesamtstaerke ueber die Saison" gewesen — absolut, relativ oder
 * gegen die Erwartung. Alle drei sind an der Stelle, an der die Auszeichnung faellt, strukturell
 * leer:
 *
 * Attribute wachsen in diesem Spiel ausschliesslich in der organischen Saisonende-Entwicklung,
 * und die laeuft im Schritt `player_development`. Der Award faellt einen Schritt FRUEHER, in
 * `season_rewards` (siehe `season-transition-chain.ts`). Zum Zeitpunkt der Ehrung hat also noch
 * niemand irgendetwas dazugewonnen. Am echten Save (`new-game-1785174792968-8d7mdx`, Saison 1,
 * nach MD10) nachgemessen: 0 von 2984 Spielern haben eine Attribut-Abweichung gegen ihre
 * Baseline, und `playerProgressionEvents` ist leer. Ein Maß auf dieser Grundlage haette jede
 * Saison denselben Sieger gekuert: keinen.
 *
 * Was zum Zeitpunkt der Ehrung WIRKLICH vorliegt, ist die Saison selbst — 2449 Einzelauftritte
 * ueber zehn Spieltage. Also misst diese Datei die Verbesserung, die tatsaechlich stattgefunden
 * hat: Wer stand am Anfang der Saison im Feld hinten und am Ende vorne?
 *
 * WIE NORMALISIERT WIRD
 *
 * `finalPlayerScore` ist zwischen Disziplinen nicht vergleichbar (Gewichtheben skaliert anders
 * als ein Laufwettbewerb). Vergleichbar ist die FELDPOSITION: `rankInDiscipline` ist der
 * ligaweite Rang innerhalb genau dieser Disziplin an genau diesem Spieltag. Umgerechnet auf
 * 0–100 ("Feldposition", 100 = Sieger des Feldes) ist der Wert unabhaengig von Disziplin und
 * Feldgroesse — und die Feldgroesse schwankt real zwischen 62 und 192 Startern.
 *
 * Der Kennwert ist die Differenz der mittleren Feldposition: zweite Saisonhaelfte minus erste.
 * Ein Spieler, der von Platz "unteres Viertel" auf "oberes Viertel" zieht, holt rund +50.
 *
 * WARUM DAS DIE INTERESSANTERE GESCHICHTE ERZAEHLT
 *
 * Absoluter Attribut-Zuwachs haette (waere er verfuegbar) mechanisch den Juengsten mit dem
 * meisten Luft-nach-oben praemiert, relativer Zuwachs den Schwaechsten — beides vorhersagbar.
 * Die Feldposition praemiert den, bei dem sich im Saisonverlauf etwas GEAENDERT hat, und ist
 * dabei blind fuer Alter, Klasse und Ausgangsstaerke. Am echten Save gewinnt ein Spieler mit
 * OVR 35, der von Feldposition 25 auf 77 zieht — kein Titelkandidat, keine Talent-Automatik,
 * sondern genau die Ueberraschung, die eine Auszeichnung ehren soll.
 *
 * GRENZEN
 *
 * Das Maß braucht Auftritte in BEIDEN Saisonhaelften. Wer erst zur Rueckrunde geholt wurde oder
 * verletzt ausfiel, hat keinen Startwert und faellt heraus statt mit einer erfundenen Null
 * bewertet zu werden. `MIN_HALF_APPEARANCES` haelt Zufallsausschlaege draussen: bei einem
 * einzigen Auftritt je Haelfte entscheidet ein guter Tag, nicht eine Entwicklung.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Mindestauftritte JE Saisonhaelfte, damit ein Spieler gewertet wird.
 *
 * Drei ist der Kompromiss, den der echte Save nahelegt: Bei einer Zehn-Spieltage-Saison mit zwei
 * Disziplinen je Spieltag sind fuenf Auftritte je Haelfte das theoretische Maximum, und eine
 * Schwelle von 5 liess nur noch 20 Spieler uebrig — zu duenn fuer eine Liga-Bestenliste. Bei 3
 * bleiben 259 Kandidaten, und der Sieger ist ueber die Schwellen 2, 3 und 4 hinweg derselbe.
 */
export const MIN_HALF_APPEARANCES = 3;

export type MostImprovedRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  /** Mittlere Feldposition der ersten Saisonhaelfte, 0–100 (100 = Feldbester). */
  earlyFieldPosition: number;
  /** Mittlere Feldposition der zweiten Saisonhaelfte, 0–100. */
  lateFieldPosition: number;
  /** Der Kennwert: `lateFieldPosition - earlyFieldPosition`, in Prozentpunkten. */
  delta: number;
  earlyAppearances: number;
  lateAppearances: number;
  /** Ligaweiter OVR-Rang — siehe `LeagueLeaderSourceRow.ovrRank`. */
  ovrRank: number | null;
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Deterministische Rangfolge: groesster Zuwachs zuerst.
 *
 * Der Gleichstand wird bewusst dreistufig aufgeloest, damit Liste und Auszeichnung bei
 * identischem Zuwachs nicht auseinanderlaufen: erst die staerkere Schlussphase (wer die Saison
 * hoeher beendet, hat die Verbesserung ueberzeugender gehalten), dann die groessere Zahl an
 * Auftritten (breiter belegt), zuletzt der Name — der ist eindeutig und macht die Reihenfolge
 * reproduzierbar statt von der Eingabereihenfolge abhaengig.
 */
export function compareMostImprovedRows(left: MostImprovedRow, right: MostImprovedRow): number {
  if (right.delta !== left.delta) {
    return right.delta - left.delta;
  }

  if (right.lateFieldPosition !== left.lateFieldPosition) {
    return right.lateFieldPosition - left.lateFieldPosition;
  }

  const leftAppearances = left.earlyAppearances + left.lateAppearances;
  const rightAppearances = right.earlyAppearances + right.lateAppearances;
  if (rightAppearances !== leftAppearances) {
    return rightAppearances - leftAppearances;
  }

  return left.name.localeCompare(right.name, "de");
}

/** Anzeigewert fuer Liste und Award — eine Quelle, damit beide dieselbe Zahl schreiben. */
export function formatMostImprovedValue(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} FP`;
}

type PerformanceSlice = {
  early: number[];
  late: number[];
  teamId: string | null;
};

/**
 * Die fertig sortierte Rangfolge. Erster Eintrag ist der Most Improved Player der Saison.
 *
 * `ovrRankByPlayerId` ist wie im `league-leaders-service` ein schmaler `{ ovrRank }`-Lookup und
 * kein voller `PlayerRatingContractRow` — der Service bleibt so von der Rating-Contract-Form
 * entkoppelt.
 */
export function buildMostImprovedRows(
  gameState: GameState,
  ovrRankByPlayerId?: ReadonlyMap<string, { ovrRank: number | null } | null | undefined>,
): MostImprovedRow[] {
  const matchdayIds = gameState.season.matchdayIds ?? [];
  if (matchdayIds.length < 2) {
    return [];
  }

  // Die Saisonhaelfte haengt am SPIELPLAN, nicht an der Zahl der bereits gespielten Spieltage:
  // sonst verschoebe sich die Grenze mit jedem Spieltag und der Kennwert waere waehrend der
  // laufenden Saison nicht stabil.
  const halfBoundary = Math.floor(matchdayIds.length / 2);
  const matchdayOrderById = new Map(matchdayIds.map((matchdayId, index) => [matchdayId, index] as const));

  // Nur Ergebnisse dieser Saison und keine annullierten — dasselbe Filtermuster wie
  // `getSeasonMatchdayResultIds` im `season-review-service`.
  const matchdayIdByResultId = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === gameState.season.id && entry.status !== "voided")
      .map((entry) => [entry.id, entry.matchdayId] as const),
  );

  const performances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) =>
    matchdayIdByResultId.has(entry.matchdayResultId),
  );

  // Feldgroesse je (Spieltag, Disziplin, Seite) — der Nenner, der `rankInDiscipline` erst
  // zwischen unterschiedlich grossen Feldern vergleichbar macht.
  const fieldSizeByGroup = new Map<string, number>();
  const groupKey = (entry: (typeof performances)[number]) =>
    `${matchdayIdByResultId.get(entry.matchdayResultId)}|${entry.disciplineId}|${entry.disciplineSide}`;
  for (const entry of performances) {
    const key = groupKey(entry);
    fieldSizeByGroup.set(key, (fieldSizeByGroup.get(key) ?? 0) + 1);
  }

  const sliceByPlayerId = new Map<string, PerformanceSlice>();
  for (const entry of performances) {
    const matchdayId = matchdayIdByResultId.get(entry.matchdayResultId);
    const order = matchdayId != null ? matchdayOrderById.get(matchdayId) : undefined;
    if (order == null) {
      continue;
    }

    const fieldSize = fieldSizeByGroup.get(groupKey(entry)) ?? 0;
    if (fieldSize < 2 || typeof entry.rankInDiscipline !== "number" || !Number.isFinite(entry.rankInDiscipline)) {
      continue;
    }

    // Feldposition 0–100: Rang 1 ergibt 100, der letzte Platz 0.
    const fieldPosition = ((fieldSize - entry.rankInDiscipline) / (fieldSize - 1)) * 100;
    const slice = sliceByPlayerId.get(entry.playerId) ?? { early: [], late: [], teamId: entry.teamId ?? null };
    (order < halfBoundary ? slice.early : slice.late).push(fieldPosition);
    slice.teamId = entry.teamId ?? slice.teamId;
    sliceByPlayerId.set(entry.playerId, slice);
  }

  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));

  const rows: MostImprovedRow[] = [];
  for (const [playerId, slice] of sliceByPlayerId) {
    // Ohne Startwert kein Zuwachs: wer in einer Haelfte zu selten (oder gar nicht) angetreten
    // ist, faellt heraus, statt mit einer erfundenen Null bewertet zu werden.
    if (slice.early.length < MIN_HALF_APPEARANCES || slice.late.length < MIN_HALF_APPEARANCES) {
      continue;
    }

    const player = playersById.get(playerId);
    if (!player) {
      continue;
    }

    const teamId = rostersByPlayerId.get(playerId)?.teamId ?? slice.teamId;
    const team = teamId ? teamsById.get(teamId) ?? null : null;
    const earlyFieldPosition = roundValue(average(slice.early), 1);
    const lateFieldPosition = roundValue(average(slice.late), 1);

    rows.push({
      playerId,
      name: player.name,
      teamId: team?.teamId ?? teamId ?? null,
      teamCode: team?.shortCode ?? null,
      teamName: team?.name ?? "—",
      earlyFieldPosition,
      lateFieldPosition,
      delta: roundValue(lateFieldPosition - earlyFieldPosition, 1),
      earlyAppearances: slice.early.length,
      lateAppearances: slice.late.length,
      ovrRank: ovrRankByPlayerId?.get(playerId)?.ovrRank ?? null,
    });
  }

  return rows.sort(compareMostImprovedRows);
}

/**
 * Der Sieger — die eine Stelle, an der "wer ist Most Improved Player" beantwortet wird.
 *
 * Bestenliste und Auszeichnung rufen beide hier an, damit Platz 1 der Liste und der Award-Sieger
 * nicht auseinanderlaufen koennen.
 */
export function resolveMostImprovedWinner(rows: MostImprovedRow[]): MostImprovedRow | null {
  return rows[0] ?? null;
}
