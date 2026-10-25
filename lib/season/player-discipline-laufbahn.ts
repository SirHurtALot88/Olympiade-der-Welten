import type {
  GameState,
  InjuryEventRecord,
  PlayerDisciplinePerformanceRecord,
  SeasonSnapshotPlayerDisciplineBreakdownRecord,
} from "@/lib/data/olyDataTypes";
import { resolveInjuryMatchdayDisciplines } from "@/lib/foundation/player-injury-history";

/**
 * DISZIPLIN-LAUFBAHN (Q2) — eine Rechenstelle, nach dem Muster von `buildPlayerSeasonAwards`
 * (`lib/foundation/player-season-awards.ts`): laufende Saison aus den Spieltagen, frühere aus den
 * Saison-Schnappschüssen, eine Funktion, mehrere Anzeigeorte.
 *
 * Spezifikation: docs/design/fable-konzept-chris-feedback-13-10.md Abschnitt 3.2,
 * docs/design/disziplin-laufbahn-q2-15-10.md (Audit, was tatsächlich aus einem Boxscore kommt und
 * was nicht).
 *
 * WARUM NUR DIESE ZÄHLER: 3.2.3 schlägt je Chassis einen eigenen Katalog vor (Arena:
 * Ausschaltungen/Schaden/Assists, Feldspiel: Rebounds/Steals, Bühne-Duell: Duelle gewonnen, ...).
 * Nachgemessen (Design-Doc Abschnitt 2) trägt KEINER dieser Werte heute über einen Boxscore bis in
 * den Spielstand — `ArenaFixtureBoxscoreEintrag` und `PlayerDisciplinePerformanceRecord` kennen nur
 * einen skalaren `finalPlayerScore`/`wert` plus den ligaweiten `rankInDiscipline`. Der Motor FÜHRT
 * die reicheren Zähler zwar (`u.st.{dmg,ko,assists,heal}` in `battle-mode.engine.js`), reicht sie
 * aber nie über `window.__arena.spieleFeldspiel()`/`spieleBuehneHeben()` hinaus — sie zu persistieren
 * wäre eine Änderung an der gemeinsamen Engine-Ausgabe für alle sechs Chassis, nicht an diesem
 * Datenmodell-Baustein. Was hier steht, ist deshalb absichtlich chassis-übergreifend EIN Satz
 * Zähler, gebaut nur aus Feldern, die JEDE der zwanzig Disziplinen schon heute über denselben Weg
 * (`legacy-matchday-resolve-engine.ts`) füllt — „Zähler, nie Ereignisse", „wo nicht, fällt er weg".
 */

export type LaufbahnAccumulator = {
  starts: number;
  rang1: number;
  top3: number;
  rangSumme: number;
  bestRang: number | null;
  bestWertung: number | null;
  spielerDesSpieltags: number;
};

export function initLaufbahnAccumulator(): LaufbahnAccumulator {
  return {
    starts: 0,
    rang1: 0,
    top3: 0,
    rangSumme: 0,
    bestRang: null,
    bestWertung: null,
    spielerDesSpieltags: 0,
  };
}

/** Faltet EINE Performance-Zeile in den Akkumulator. Mutiert nicht, gibt den neuen Stand zurück. */
export function foldLaufbahnEntry(
  acc: LaufbahnAccumulator,
  entry: Pick<PlayerDisciplinePerformanceRecord, "rankInDiscipline" | "finalPlayerScore" | "isMvpCandidate">,
): LaufbahnAccumulator {
  const rang = typeof entry.rankInDiscipline === "number" && Number.isFinite(entry.rankInDiscipline) ? entry.rankInDiscipline : null;
  const wertung =
    typeof entry.finalPlayerScore === "number" && Number.isFinite(entry.finalPlayerScore) ? entry.finalPlayerScore : null;
  return {
    starts: acc.starts + 1,
    rang1: acc.rang1 + (rang === 1 ? 1 : 0),
    top3: acc.top3 + (rang != null && rang <= 3 ? 1 : 0),
    rangSumme: acc.rangSumme + (rang ?? 0),
    bestRang: rang == null ? acc.bestRang : acc.bestRang == null ? rang : Math.min(acc.bestRang, rang),
    bestWertung: wertung == null ? acc.bestWertung : acc.bestWertung == null ? wertung : Math.max(acc.bestWertung, wertung),
    spielerDesSpieltags: acc.spielerDesSpieltags + (entry.isMvpCandidate ? 1 : 0),
  };
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Wandelt den Akkumulator in die persistierbare/anzeigbare Form. `verletzungen` kommt von
 * außerhalb (Spieltags-Einsatzliste, nicht Teil der Performance-Zeile selbst) und wird nur
 * geschrieben, wenn mindestens eine Verletzung zählt — nie als erfundene „0".
 */
export function finalizeLaufbahnCounters(acc: LaufbahnAccumulator, verletzungen?: number): Record<string, number> | undefined {
  if (acc.starts <= 0) {
    return undefined;
  }
  const result: Record<string, number> = {
    starts: acc.starts,
    siege: acc.rang1,
    podien: acc.top3,
    rangSumme: acc.rangSumme,
  };
  if (acc.bestRang != null) result.bestRang = acc.bestRang;
  if (acc.bestWertung != null) result.bestWertung = roundTo(acc.bestWertung, 1);
  if (acc.spielerDesSpieltags > 0) result.spielerDesSpieltags = acc.spielerDesSpieltags;
  if (verletzungen && verletzungen > 0) result.verletzungen = verletzungen;
  return result;
}

/** Bequemlichkeits-Wrapper: faltet ein ganzes Array in einem Rutsch. */
export function computeLaufbahnCountersForPerformances(
  performances: readonly Pick<PlayerDisciplinePerformanceRecord, "rankInDiscipline" | "finalPlayerScore" | "isMvpCandidate">[],
  verletzungen?: number,
): Record<string, number> | undefined {
  const acc = performances.reduce<LaufbahnAccumulator>((current, entry) => foldLaufbahnEntry(current, entry), initLaufbahnAccumulator());
  return finalizeLaufbahnCounters(acc, verletzungen);
}

/**
 * Summiert zwei bereits fertige Zähler-Records (z. B. mehrere Saisons zu einer Karriere-Summe).
 * `bestRang` wird als Minimum, `bestWertung` als Maximum zusammengeführt — alles andere summiert.
 * Unbekannte Schlüssel (ein künftiges Feld, das diese Funktion noch nicht kennt) werden NICHT
 * verworfen, sondern ebenfalls summiert, damit ein neuer Zähler nicht erst hier eingetragen werden
 * muss, bevor er in der Karriere-Summe ankommt.
 */
export function mergeLaufbahnCounters(
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!left) return right;
  if (!right) return left;
  const merged: Record<string, number> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (!(key in merged)) {
      merged[key] = value;
      continue;
    }
    merged[key] = key === "bestRang" ? Math.min(merged[key], value) : key === "bestWertung" ? Math.max(merged[key], value) : merged[key] + value;
  }
  return merged;
}

/**
 * Verletzungen der Saison je Disziplin, aus der Spieltags-Einsatzliste aufgelöst (dieselbe
 * Funktion, die die Verletzungshistorie im Drawer schon nutzt). `Map<playerId, Map<disciplineId,
 * count>>`. Steht ein Spieler am Verletzungs-Spieltag in beiden Disziplinen, zählt die Verletzung
 * bei beiden (s. Kommentar an `SeasonSnapshotPlayerDisciplineBreakdownRecord.laufbahn`).
 */
export function buildSeasonInjuryDisciplineCounts(
  gameState: Pick<GameState, "disciplines" | "season" | "seasonState">,
  seasonId: string,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  const events: InjuryEventRecord[] = (gameState.seasonState.injuryEvents ?? []).filter(
    (event) => event.seasonId === seasonId && event.result === "injured",
  );
  for (const event of events) {
    const disziplinen = resolveInjuryMatchdayDisciplines({
      gameState: gameState as GameState,
      teamId: event.teamId,
      playerId: event.playerId,
      matchdayId: event.matchdayId,
      seasonId: event.seasonId,
    });
    if (disziplinen.length === 0) continue;
    const byDiscipline = result.get(event.playerId) ?? new Map<string, number>();
    for (const { disciplineId } of disziplinen) {
      byDiscipline.set(disciplineId, (byDiscipline.get(disciplineId) ?? 0) + 1);
    }
    result.set(event.playerId, byDiscipline);
  }
  return result;
}

export type PlayerDisciplineLaufbahnSeason = {
  seasonId: string;
  seasonName: string;
  isActiveSeason: boolean;
  appearances: number;
  counters: Record<string, number>;
};

export type PlayerDisciplineLaufbahn = {
  disciplineId: string;
  careerAppearances: number;
  career: Record<string, number>;
  /** Neueste Saison zuerst — wie `buildPlayerSeasonAwards`. */
  seasons: PlayerDisciplineLaufbahnSeason[];
};

/**
 * Die Laufbahn EINES Spielers über alle Disziplinen, in denen er je angetreten ist — laufende
 * Saison live aus den Spieltagen, frühere Saisons aus `disciplineBreakdown[].laufbahn` der
 * Schnappschüsse. Ein Schnappschuss ohne dieses Feld (jeder Stand vor dieser Änderung) trägt
 * einfach keine Saison-Zeile mit Zählern — appearances/Name bleiben über die bestehenden Felder
 * trotzdem sichtbar, nur eben ohne `counters`.
 */
export function buildPlayerDisciplineLaufbahn(gameState: GameState, playerId: string): Map<string, PlayerDisciplineLaufbahn> {
  const result = new Map<string, PlayerDisciplineLaufbahn>();
  if (!playerId) return result;

  const ensure = (disciplineId: string): PlayerDisciplineLaufbahn => {
    const existing = result.get(disciplineId);
    if (existing) return existing;
    const created: PlayerDisciplineLaufbahn = { disciplineId, careerAppearances: 0, career: {}, seasons: [] };
    result.set(disciplineId, created);
    return created;
  };

  // Laufende Saison: direkt aus den gebuchten Spieltagen, nie aus einem Zwischenstand, der sich
  // noch ändern könnte, aber auch nie inkrementell fortgeschrieben — jedes Mal frisch über die
  // komplette, je Spieltag wholesale ersetzte `playerDisciplinePerformances`-Liste gefaltet. Eine
  // Neubuchung eines ÄLTEREN Spieltags verändert dabei nie das Ergebnis eines NEUEREN: beide
  // Spieltage werden hier gleichberechtigt aus dem aktuellen Endzustand gelesen, es gibt keinen
  // Zwischenzähler, den eine falsche Reihenfolge verfälschen könnte (der O7-Fehler aus dem
  // Achtzehnten Nachtrag).
  const currentSeasonId = gameState.season.id;
  const appliedResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === currentSeasonId && entry.status === "preview_applied")
      .map((entry) => entry.id),
  );
  if (appliedResultIds.size > 0) {
    const currentPerformances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter(
      (entry) => entry.playerId === playerId && appliedResultIds.has(entry.matchdayResultId),
    );
    if (currentPerformances.length > 0) {
      const byDiscipline = new Map<string, PlayerDisciplinePerformanceRecord[]>();
      for (const entry of currentPerformances) {
        const list = byDiscipline.get(entry.disciplineId) ?? [];
        list.push(entry);
        byDiscipline.set(entry.disciplineId, list);
      }
      const injuries = buildSeasonInjuryDisciplineCounts(gameState, currentSeasonId).get(playerId);
      for (const [disciplineId, entries] of byDiscipline) {
        const counters = computeLaufbahnCountersForPerformances(entries, injuries?.get(disciplineId));
        if (!counters) continue;
        const bucket = ensure(disciplineId);
        bucket.seasons.push({
          seasonId: currentSeasonId,
          seasonName: gameState.season.name,
          isActiveSeason: true,
          appearances: entries.length,
          counters,
        });
        bucket.career = mergeLaufbahnCounters(bucket.career, counters) ?? bucket.career;
        bucket.careerAppearances += entries.length;
      }
    }
  }

  // Frühere Saisons: ausschließlich aus den Schnappschüssen, nie neu aus Spieltagsdaten gerechnet,
  // die zum Saisonwechsel ohnehin nicht mehr vollständig vorliegen (3.2.1).
  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) {
    if (snapshot.seasonId === currentSeasonId) continue; // laufende Saison kommt oben, nie doppelt
    const row = snapshot.playerPerformances?.find((entry) => entry.playerId === playerId);
    if (!row) continue;
    for (const discipline of row.disciplineBreakdown ?? []) {
      const counters: SeasonSnapshotPlayerDisciplineBreakdownRecord["laufbahn"] = discipline.laufbahn;
      if (!counters) continue; // Schnappschuss von vor dieser Änderung — keine Zähler, keine Zeile
      const bucket = ensure(discipline.disciplineId);
      bucket.seasons.push({
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        isActiveSeason: false,
        appearances: discipline.appearances,
        counters,
      });
      bucket.career = mergeLaufbahnCounters(bucket.career, counters) ?? bucket.career;
      bucket.careerAppearances += discipline.appearances;
    }
  }

  for (const bucket of result.values()) {
    bucket.seasons.sort((left, right) => {
      if (left.isActiveSeason !== right.isActiveSeason) return left.isActiveSeason ? -1 : 1;
      return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
    });
  }
  return result;
}
