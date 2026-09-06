import type {
  DisciplineCategory,
  Discipline,
  GameState,
  Matchday,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSlot,
} from "@/lib/data/olyDataTypes";
import { isBattleModeSave } from "@/lib/season/game-mode";

const SCHEDULE_SOURCE_NOTE =
  "Legacy-Fallback fuer alte Saves ohne vollstaendigen Season-Schedule.";

type ScheduledDiscipline = {
  discipline: Discipline;
  playerCount: number;
};

/**
 * WIE OFT kommt jede Disziplin in EINER Saison dieses Saves vor — Battle Mode 20 Spieltage
 * (docs/design/battle-mode-20-spieltage-recherche-06-09.md, Chris 06.09.: „jede kommt 2x dran").
 *
 * W1 (diese PR) baut nur die repeat-bewusste Struktur (diese Funktion, `getRequiredSeason-
 * DisciplineMatchdayCount`, `hasCompleteSeasonDisciplineSchedule`, `buildNormalizedMatchdayIds`,
 * `buildSeasonSeededDisciplineSchedule`) und beweist sie per Test — sie wird bewusst NOCH NICHT
 * aus `getSeasonDisciplineSchedule`/`buildResolvedSeasonDisciplineSchedule` heraus aufgerufen.
 * Jeder Erzeuger der Saisonlaenge (E1 `dataAdapter.ts`, E2 `new-game-setup-service.ts`, E3
 * `preseason-workflow-service.ts`) haelt weiterhin 10 `matchdayIds` fuer JEDEN Save, Battle
 * Mode eingeschlossen — das Umschalten dieser Erzeuger ist W2 und braucht zuerst die aktive
 * Erholung (Fatigue-PR3, s. `docs/design/fatigue-saisonlaenge-plan.md` Teil C). Bis dahin gibt
 * kein Aufrufer im Produktionscode `repeat: 2` weiter, und jede Ausgabe bleibt bit-identisch zum
 * Stand vor dieser PR — analog zu `isLeagueSplitActive()` in PR 1 des Liga-Splits (Schalter da,
 * Erzeuger folgt spaeter).
 */
export function getSeasonDisciplineRepeatCount(gameState: Pick<GameState, "scenarioMeta">): 1 | 2 {
  return isBattleModeSave(gameState) ? 2 : 1;
}

function toScheduleSlot(
  discipline: Discipline | null,
  playerCountOverride?: number | null,
  occurrenceInSeason?: 1 | 2,
): SeasonDisciplineScheduleSlot | null {
  if (!discipline) {
    return null;
  }

  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: playerCountOverride ?? discipline.playerCount ?? null,
    category: discipline.category,
    ...(occurrenceInSeason != null ? { occurrenceInSeason } : {}),
  };
}

function hashToUint(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashToUint(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(items: T[], seed: string) {
  const next = [...items];
  const random = createSeededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

/**
 * Kadergroesse je Seite fuer eine Disziplin -- GLEICHVERTEILT auf {2,3,4,5,6}, keine Sonderrolle
 * fuer die konfigurierte Basisgroesse (Chris-Entscheidung, 06.09.).
 *
 * Vorher warf diese Funktion `rolled` gleichverteilt aus {2..6}, verschob den Treffer bei
 * `rolled === base` aber zusaetzlich noch um +-1 -- mit dem Effekt, dass `base` fuer jede
 * Basisgroesse in der Mitte des Bereichs (3, 4, 5) rechnerisch NIE herauskam: der direkte Treffer
 * (1/5) wurde immer weggeschoben, und der Verschiebe-Schritt eines nicht-benachbarten Wurfs traf
 * die Basis nie. Nur an den Raendern (Basis 2 oder 6) kam die Basis noch mit halbierter
 * Wahrscheinlichkeit vor (Klammerung am Rand faengt die Verschiebung teilweise wieder ein). Diese
 * Funktion ist im Produktionspfad seit dem Umstieg auf den kategorie-balancierten Zweig in
 * `buildSeasonPlayerCountByDiscipline` (Kategorien mit genau fuenf Disziplinen -- alle vier
 * Kategorien treffen das heute) bereits inaktiv; sie bleibt als Ersatzweg fuer den Fall, dass eine
 * Kategorie irgendwann nicht mehr genau fuenf Disziplinen zaehlt, und muss deshalb dieselbe echte
 * Gleichverteilung liefern wie der Hauptpfad.
 */
function buildSeasonPlayerCount(discipline: Discipline, seed: string) {
  const random = createSeededRandom(`${seed}:players:${discipline.id}`);
  return 2 + Math.floor(random() * 5);
}

function buildSeasonPlayerCountByDiscipline(disciplines: Discipline[], seed: string) {
  const countByDisciplineId = new Map<string, number>();
  const groupedByCategory = new Map<DisciplineCategory, Discipline[]>();

  for (const discipline of disciplines) {
    const group = groupedByCategory.get(discipline.category) ?? [];
    group.push(discipline);
    groupedByCategory.set(discipline.category, group);
  }

  for (const [category, categoryDisciplines] of groupedByCategory) {
    const ordered = sortDisciplinesForSeasonSchedule(categoryDisciplines);
    if (ordered.length === 5) {
      const counts = shuffleSeeded([2, 3, 4, 5, 6], `${seed}:player-count-balance:${category}`);
      ordered.forEach((discipline, index) => {
        countByDisciplineId.set(discipline.id, counts[index] ?? buildSeasonPlayerCount(discipline, seed));
      });
      continue;
    }

    ordered.forEach((discipline) => {
      countByDisciplineId.set(discipline.id, buildSeasonPlayerCount(discipline, seed));
    });
  }

  return countByDisciplineId;
}

/**
 * Seeded Derangement (fixpunktfreie Permutation) einer Indexmenge 0..size-1 — `sigma(i) != i`
 * fuer alle i. Fisher-Yates ziehen, bei Fixpunkt verwerfen und weiterziehen (44 von 120
 * Permutationen bei size=5 sind Derangements, erwartete Zuege < 3), gedeckelt auf 32 Versuche mit
 * Rueckfall „Rotation um eine Position" (fuer size > 1 IMMER fixpunktfrei, terminiert also
 * garantiert). Recherche Abschnitt 3b.
 */
function buildSeededDerangement(size: number, seed: string): number[] {
  const identity = Array.from({ length: size }, (_, index) => index);
  if (size <= 1) {
    return identity;
  }

  const random = createSeededRandom(seed);
  const MAX_ATTEMPTS = 32;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const permutation = [...identity];
    for (let index = permutation.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
    }
    if (permutation.every((value, index) => value !== index)) {
      return permutation;
    }
  }

  return identity.map((_, index) => (index + 1) % size);
}

/**
 * Kadergroesse des ZWEITEN Saison-Vorkommens je Disziplin — Derangement der Zuteilung des ersten
 * Vorkommens (`baseCountByDisciplineId`), je Kategorie: Disziplin i bekommt die Groesse von
 * Disziplin sigma(i) mit sigma(i) != i, also nie wieder ihre eigene Erstgroesse. Haelt damit
 * `[2,3,4,5,6]` je Kategorie auch in Haelfte 2 exakt. Ersatzzweig fuer Kategorien != 5
 * Disziplinen (heute nicht produktiv): gleichverteilt aus `{2..6} \ {erste Groesse}`.
 */
function buildDerangedPlayerCountByDiscipline(
  disciplines: Discipline[],
  baseCountByDisciplineId: Map<string, number>,
  seed: string,
): Map<string, number> {
  const countByDisciplineId = new Map<string, number>();
  const groupedByCategory = new Map<DisciplineCategory, Discipline[]>();

  for (const discipline of disciplines) {
    const group = groupedByCategory.get(discipline.category) ?? [];
    group.push(discipline);
    groupedByCategory.set(discipline.category, group);
  }

  for (const [category, categoryDisciplines] of groupedByCategory) {
    const ordered = sortDisciplinesForSeasonSchedule(categoryDisciplines);
    const baseCounts = ordered.map((discipline) => baseCountByDisciplineId.get(discipline.id) ?? null);

    if (ordered.length === 5 && baseCounts.every((count): count is number => count != null)) {
      const derangement = buildSeededDerangement(ordered.length, `${seed}:derangement:${category}`);
      ordered.forEach((discipline, index) => {
        countByDisciplineId.set(discipline.id, baseCounts[derangement[index]] as number);
      });
      continue;
    }

    ordered.forEach((discipline) => {
      const base = baseCountByDisciplineId.get(discipline.id) ?? null;
      const pool = ([2, 3, 4, 5, 6] as const).filter((value) => value !== base);
      const random = createSeededRandom(`${seed}:derangement-fallback:${discipline.id}`);
      const picked = pool[Math.floor(random() * pool.length)] ?? buildSeasonPlayerCount(discipline, seed);
      countByDisciplineId.set(discipline.id, picked);
    });
  }

  return countByDisciplineId;
}

function buildSeededDisciplinePairs(input: {
  disciplines: Discipline[];
  seed: string;
  requiredMatchdays: number;
  maxCombinedPlayerCount: number;
  /**
   * Additiv, optional: fertige Kadergroessen-Zuteilung, die statt der internen
   * `buildSeasonPlayerCountByDiscipline`-Ziehung verwendet wird — der Weg, ueber den Haelfte 2
   * eines Battle-Mode-Repeat-Spielplans ihre Derangement-Groessen einbringt, ohne diese Funktion
   * sonst zu veraendern. Ohne dieses Feld (jeder heutige Aufrufer) exakt das alte Verhalten.
   */
  playerCountByDisciplineId?: Map<string, number>;
}): { pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]>; warnings: string[] } {
  const shuffled = shuffleSeeded(sortDisciplinesForSeasonSchedule(input.disciplines), input.seed);
  const playerCountByDisciplineId =
    input.playerCountByDisciplineId ?? buildSeasonPlayerCountByDiscipline(input.disciplines, input.seed);
  const available = shuffled.map((discipline) => ({
    discipline,
    playerCount: playerCountByDisciplineId.get(discipline.id) ?? buildSeasonPlayerCount(discipline, input.seed),
  }));
  const pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]> = [];
  const warnings: string[] = [];

  for (let index = 0; index < input.requiredMatchdays; index += 1) {
    const first = available.shift() ?? null;
    if (!first) {
      pairs.push([null, null]);
      warnings.push("season_schedule_discipline_pool_exhausted");
      continue;
    }

    const firstCount = first.playerCount;
    let secondIndex = available.findIndex(
      (candidate) => firstCount + candidate.playerCount <= input.maxCombinedPlayerCount,
    );
    if (secondIndex < 0) {
      secondIndex = available.reduce((lowestIndex, candidate, candidateIndex) => {
        const lowest = available[lowestIndex];
        return !lowest || candidate.playerCount < lowest.playerCount ? candidateIndex : lowestIndex;
      }, 0);
      warnings.push(`season_schedule_pair_over_roster_limit:${first.discipline.id}`);
    }
    const second = secondIndex >= 0 ? available.splice(secondIndex, 1)[0] ?? null : null;
    pairs.push([first, second]);
  }

  return { pairs, warnings: Array.from(new Set(warnings)) };
}

export function getDisciplineColor(category?: DisciplineCategory | null) {
  if (category === "power") return "red";
  if (category === "speed") return "green";
  if (category === "mental") return "blue";
  if (category === "social") return "yellow";
  return null;
}

export function sortDisciplinesForSeasonSchedule(disciplines: Discipline[]) {
  return [...disciplines].sort((left, right) => {
    const leftOrder = left.displayOrder ?? left.originalOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? right.originalOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "de");
  });
}

/**
 * Benoetigte Spieltage fuer den Spielplan — `repeat` ist, wie oft jede Disziplin in der Saison
 * vorkommen soll (1 = heutiges Verhalten/Manager Mode, 2 = Battle Mode 20 Spieltage, W1/W2). Ohne
 * zweites Argument bit-identisch zum Stand vor dieser PR.
 */
export function getRequiredSeasonDisciplineMatchdayCount(disciplines: Discipline[], repeat = 1) {
  const disciplineCount = sortDisciplinesForSeasonSchedule(disciplines).length;
  return Math.max(1, Math.ceil((disciplineCount * Math.max(1, repeat)) / 2));
}

function sortScheduleEntries(entries: SeasonDisciplineScheduleEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.matchdayIndex !== right.matchdayIndex) {
      return left.matchdayIndex - right.matchdayIndex;
    }
    return left.matchdayId.localeCompare(right.matchdayId, "de");
  });
}

function buildNormalizedMatchdayIds(input: {
  seasonId: string;
  disciplines: Discipline[];
  matchdayIds?: string[] | null;
  repeat?: number;
}) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines, input.repeat ?? 1);
  if (input.matchdayIds && input.matchdayIds.length >= requiredMatchdays) {
    return input.matchdayIds.slice(0, requiredMatchdays);
  }
  const usesLegacySeasonOneIds = (input.matchdayIds ?? []).some((matchdayId) => /^matchday-\d+$/.test(matchdayId));
  return Array.from({ length: requiredMatchdays }, (_, index) =>
    usesLegacySeasonOneIds ? `matchday-${index + 1}` : `${input.seasonId}-matchday-${index + 1}`,
  );
}

export function hasCompleteSeasonDisciplineSchedule(input: {
  disciplines: Discipline[];
  disciplineSchedule?: SeasonDisciplineScheduleEntry[] | null;
  seasonId?: string | null;
  repeat?: number;
}) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines, input.repeat ?? 1);
  const schedule = (input.disciplineSchedule ?? []).filter((entry) => !input.seasonId || entry.seasonId === input.seasonId);
  if (schedule.length < requiredMatchdays) {
    return false;
  }

  const relevantEntries = sortScheduleEntries(schedule).slice(0, requiredMatchdays);
  if (relevantEntries.length !== requiredMatchdays) {
    return false;
  }
  if (relevantEntries.some((entry) => entry.sourceStatus === "legacy_seed" || entry.sourceStatus === "discipline_schedule_rule_missing")) {
    return false;
  }

  const uniqueMatchdayIds = new Set(relevantEntries.map((entry) => entry.matchdayId));
  return uniqueMatchdayIds.size === requiredMatchdays;
}

export function buildLegacySeedSeasonDisciplineSchedule(input: {
  seasonId: string;
  disciplines: Discipline[];
  matchdayIds?: string[];
}): SeasonDisciplineScheduleEntry[] {
  const ordered = sortDisciplinesForSeasonSchedule(input.disciplines);
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines);
  const matchdayIds =
    input.matchdayIds && input.matchdayIds.length >= requiredMatchdays
      ? input.matchdayIds.slice(0, requiredMatchdays)
      : Array.from({ length: requiredMatchdays }, (_, index) => `matchday-${index + 1}`);

  return matchdayIds.map((matchdayId, index) => {
    const discipline1 = ordered[index * 2] ?? null;
    const discipline2 = ordered[index * 2 + 1] ?? null;

    return {
      seasonId: input.seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: toScheduleSlot(discipline1),
      discipline2: toScheduleSlot(discipline2),
      sourceStatus: "legacy_seed",
      sourceNote: SCHEDULE_SOURCE_NOTE,
    };
  });
}

export function buildSeasonSeededDisciplineSchedule(input: {
  saveId: string;
  seasonId: string;
  disciplines: Discipline[];
  scheduleVersion?: string;
  matchdayCount?: number;
  matchdayIds?: string[];
  maxCombinedPlayerCount?: number;
  /**
   * Wie oft jede Disziplin in dieser Saison vorkommen soll — 1 (Default, heutiges Verhalten) oder
   * 2 (Battle Mode 20 Spieltage, W1/W2). Ohne dieses Feld exakt der Stand vor dieser PR: EIN
   * Aufruf von `buildSeededDisciplinePairs`, keine `occurrenceInSeason`-Markierung. Bei `repeat:
   * 2` zwei Halbserien (`buildSeededDisciplinePairs` zweimal, Sub-Seeds `:half-1`/`:half-2`),
   * Haelfte 2 mit einer Derangement-Kadergroesse je Kategorie (Recherche Abschnitt 3a/3b). KEIN
   * Produktions-Aufrufer setzt dieses Feld heute — siehe `getSeasonDisciplineRepeatCount`.
   */
  repeat?: number;
}): { entries: SeasonDisciplineScheduleEntry[]; matchdayIds: string[]; scheduleSeed: string; warnings: string[] } {
  const scheduleVersion = input.scheduleVersion ?? "season-setup-v3-balanced-slot-buckets";
  const scheduleSeed = `${input.saveId}:${input.seasonId}:${scheduleVersion}`;
  const repeat = Math.max(1, Math.round(input.repeat ?? 1));
  const requiredMatchdays = Math.max(
    1,
    input.matchdayCount ?? getRequiredSeasonDisciplineMatchdayCount(input.disciplines, repeat),
  );
  const matchdayIds =
    input.matchdayIds && input.matchdayIds.length >= requiredMatchdays
      ? input.matchdayIds.slice(0, requiredMatchdays)
      : Array.from({ length: requiredMatchdays }, (_, index) => `${input.seasonId}-matchday-${index + 1}`);
  /**
   * KEIN DECKEL MEHR — Chris: „der spielplan soll nichts deckeln! auch 12 soll möglich sein! das
   * soll ja dann der vorteil sein für teams die bereit sind auch mal 12 oder 13 spieler zu picken!"
   *
   * Der Standardwert war 10. Damit fielen die groessten Paarungen weg, obwohl sie moeglich sind:
   * der Disziplin-Pool traegt je viermal 2, 3, 4, 5 und 6 Spieler — die beiden groessten ergeben
   * zusammen 12. Gemessen an der Saison des Live-Spielstands schob der Deckel genau eine Paarung
   * um (Spieltag 9/10 tauschten, mit Warnung `season_schedule_pair_over_roster_limit`); die
   * uebrigen acht blieben gleich. Ein grosser Spieltag ist damit nicht mehr ein Ausrutscher, den
   * die Ersatzregel durchwinkt, sondern eine regulaere Auslosung.
   *
   * Der Sinn dahinter ist ein Spielvorteil, kein Zufall: wer einen breiten Kader haelt, kann an
   * einem 12er-Spieltag alle Plaetze besetzen, waehrend ein schmaler Kader passen muss. Der
   * Deckel nahm genau diese Entscheidung aus dem Spiel.
   *
   * Der Parameter bleibt, damit Tests und Sonderlaeufe weiterhin eng fuehren koennen.
   */
  const maxCombinedPlayerCount = input.maxCombinedPlayerCount ?? Number.POSITIVE_INFINITY;

  let pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]>;
  let pairWarnings: string[];
  let occurrenceInSeasonByPairIndex: Array<1 | 2 | undefined>;

  if (repeat <= 1) {
    // Exakt der Pfad von vor dieser PR: EIN Aufruf, keine Halbserien, keine
    // `occurrenceInSeason`-Markierung — Manager Mode und jeder Alt-Save.
    const paired = buildSeededDisciplinePairs({
      disciplines: input.disciplines,
      seed: scheduleSeed,
      requiredMatchdays,
      maxCombinedPlayerCount,
    });
    pairs = paired.pairs;
    pairWarnings = paired.warnings;
    occurrenceInSeasonByPairIndex = pairs.map(() => undefined);
  } else {
    // Battle Mode, repeat=2: zwei Halbserien. Haelfte 1 nutzt exakt die heutige
    // kategorie-balancierte Permutation (nur mit dem Sub-Seed `:half-1`); Haelfte 2 zieht je
    // Kategorie ein Derangement von Haelfte 1s Zuteilung, damit KEINE Disziplin ihre Erstgroesse
    // wiederholt (Recherche Abschnitt 3b). Kein Mindestabstand an der Nahtstelle Spieltag
    // 10/11 (Chris 30.08., ausdruecklich bestaetigt).
    const halfOneMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines, 1);
    const halfTwoMatchdays = Math.max(0, requiredMatchdays - halfOneMatchdays);
    const halfOneSeed = `${scheduleSeed}:half-1`;
    const halfTwoSeed = `${scheduleSeed}:half-2`;

    const halfOnePlayerCounts = buildSeasonPlayerCountByDiscipline(input.disciplines, halfOneSeed);
    const halfTwoPlayerCounts = buildDerangedPlayerCountByDiscipline(input.disciplines, halfOnePlayerCounts, halfTwoSeed);

    const halfOnePaired = buildSeededDisciplinePairs({
      disciplines: input.disciplines,
      seed: halfOneSeed,
      requiredMatchdays: halfOneMatchdays,
      maxCombinedPlayerCount,
      playerCountByDisciplineId: halfOnePlayerCounts,
    });
    const halfTwoPaired = buildSeededDisciplinePairs({
      disciplines: input.disciplines,
      seed: halfTwoSeed,
      requiredMatchdays: halfTwoMatchdays,
      maxCombinedPlayerCount,
      playerCountByDisciplineId: halfTwoPlayerCounts,
    });

    pairs = [...halfOnePaired.pairs, ...halfTwoPaired.pairs];
    pairWarnings = [...halfOnePaired.warnings, ...halfTwoPaired.warnings];
    occurrenceInSeasonByPairIndex = [
      ...halfOnePaired.pairs.map(() => 1 as const),
      ...halfTwoPaired.pairs.map(() => 2 as const),
    ];
  }

  const warnings = [
    ...(input.disciplines.length * repeat < requiredMatchdays * 2 ? ["season_schedule_discipline_pool_smaller_than_slots"] : []),
    ...Array.from(new Set(pairWarnings)),
  ];

  const entries = matchdayIds.map((matchdayId, index) => {
    const [discipline1, discipline2] = pairs[index] ?? [null, null];
    const occurrenceInSeason = occurrenceInSeasonByPairIndex[index];

    return {
      seasonId: input.seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: toScheduleSlot(discipline1?.discipline ?? null, discipline1?.playerCount ?? null, occurrenceInSeason),
      discipline2: toScheduleSlot(discipline2?.discipline ?? null, discipline2?.playerCount ?? null, occurrenceInSeason),
      sourceStatus: "season_seed",
      sourceNote: `Season-spezifischer Schedule-Seed: ${scheduleSeed}`,
    } satisfies SeasonDisciplineScheduleEntry;
  });

  return { entries, matchdayIds, scheduleSeed, warnings };
}

export function buildMatchdaysFromSeasonDisciplineSchedule(
  seasonId: string,
  entries: SeasonDisciplineScheduleEntry[],
  existingFixtureIdsByMatchdayId?: Record<string, string[]>,
): Matchday[] {
  return entries.map((entry) => ({
    id: entry.matchdayId,
    seasonId,
    index: entry.matchdayIndex,
    label: entry.matchdayLabel,
    fixtureIds: existingFixtureIdsByMatchdayId?.[entry.matchdayId] ?? [],
  }));
}

function scheduleHasPopulatedDisciplineSlots(entries: SeasonDisciplineScheduleEntry[]) {
  return entries.some((entry) => Boolean(entry.discipline1?.disciplineId || entry.discipline2?.disciplineId));
}

function buildResolvedSeasonDisciplineSchedule(
  gameState: GameState,
  saveId = "normalized-local-save",
): SeasonDisciplineScheduleEntry[] {
  const matchdayIds = buildNormalizedMatchdayIds({
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds: gameState.season.matchdayIds,
  });
  return buildSeasonSeededDisciplineSchedule({
    saveId,
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds,
    matchdayCount: matchdayIds.length,
  }).entries;
}

export function getSeasonDisciplineScheduleEntry(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
) {
  const schedule = getSeasonDisciplineSchedule(gameState, options);
  return schedule.find((entry) => entry.matchdayId === matchdayId) ?? null;
}

export function getSeasonDisciplineSchedule(gameState: GameState, options?: { saveId?: string | null }) {
  const saveId = options?.saveId ?? "normalized-local-save";
  const stored = gameState.seasonState.disciplineSchedule ?? [];
  if (
    hasCompleteSeasonDisciplineSchedule({
      disciplines: gameState.disciplines,
      disciplineSchedule: stored,
      seasonId: gameState.season.id,
    })
  ) {
    const activeSchedule = sortScheduleEntries(stored.filter((entry) => entry.seasonId === gameState.season.id));
    if (scheduleHasPopulatedDisciplineSlots(activeSchedule) || gameState.disciplines.length === 0) {
      return activeSchedule;
    }
  }

  if (gameState.disciplines.length === 0) {
    return sortScheduleEntries(stored.filter((entry) => entry.seasonId === gameState.season.id));
  }

  return buildResolvedSeasonDisciplineSchedule(gameState, saveId);
}

/**
 * EINE Kadergroesse je Disziplin fuer DIESE Saison — fuer Manager-Saves und jeden Alt-Save
 * (repeat=1, also heute jeder Save) gibt es davon nur eines, dieselbe Ausgabe wie vor dieser PR.
 *
 * Kommt eine Disziplin zweimal vor (Battle Mode 20 Spieltage, repeat=2 — W1 baut die Struktur,
 * kein Produktions-Aufrufer erzeugt das heute noch, s. `getSeasonDisciplineRepeatCount`), gewann
 * bisher stillschweigend das LETZTE Vorkommen (`Map.set` ueberschreibt, Recherche Abschnitt 1.8).
 * Ab jetzt gewinnt das naechste NOCH OFFENE Vorkommen (erster Spieltag-Index >=
 * `season.currentMatchday`) — das ist, was Kaderprofil und Transfermarkt-Bedarf tatsaechlich
 * fragen: „was brauche ich als naechstes". Sind alle Vorkommen bereits gespielt, faellt das auf
 * das letzte zurueck (heutiges Verhalten als Ende-der-Saison-Fallback). Fuer Ansichten, die BEIDE
 * Vorkommen zeigen wollen, siehe `getSeasonDisciplinePlayerCounts`.
 */
export function buildSeasonDisciplinePlayerCountMap(gameState: GameState) {
  const playerCountByDisciplineId = new Map<string, number | null>();
  const currentMatchday = gameState.season.currentMatchday ?? 1;

  const occurrencesByDisciplineId = new Map<string, Array<{ matchdayIndex: number; playerCount: number | null }>>();
  for (const entry of getSeasonDisciplineSchedule(gameState)) {
    const slots = [entry.discipline1, entry.discipline2];
    for (const slot of slots) {
      if (!slot?.disciplineId) {
        continue;
      }
      const occurrences = occurrencesByDisciplineId.get(slot.disciplineId) ?? [];
      occurrences.push({ matchdayIndex: entry.matchdayIndex, playerCount: slot.playerCount ?? null });
      occurrencesByDisciplineId.set(slot.disciplineId, occurrences);
    }
  }

  for (const [disciplineId, occurrences] of occurrencesByDisciplineId) {
    const sorted = [...occurrences].sort((left, right) => left.matchdayIndex - right.matchdayIndex);
    const nextOpenOccurrence = sorted.find((occurrence) => occurrence.matchdayIndex >= currentMatchday);
    const chosenOccurrence = nextOpenOccurrence ?? sorted[sorted.length - 1] ?? null;
    playerCountByDisciplineId.set(disciplineId, chosenOccurrence?.playerCount ?? null);
  }

  for (const discipline of gameState.disciplines) {
    if (!playerCountByDisciplineId.has(discipline.id)) {
      playerCountByDisciplineId.set(discipline.id, discipline.playerCount ?? null);
    }
  }

  return playerCountByDisciplineId;
}

export type SeasonDisciplinePlayerCountOccurrence = {
  matchdayId: string;
  matchdayIndex: number;
  playerCount: number | null;
  occurrenceInSeason: 1 | 2 | null;
};

/**
 * ALLE Saison-Vorkommen einer Disziplin mit ihrer jeweiligen Kadergroesse — fuer Ansichten, die
 * bei Battle-Mode-Repeat (repeat=2) beide Vorkommen zeigen wollen (z. B. „Hinrunde 4 · Rueckrunde
 * 6"). Fuer repeat=1/jeden heutigen Save liefert das genau ein Element, identisch zu dem, was
 * `buildSeasonDisciplinePlayerCountMap` fuer dieselbe Disziplin traegt. Der Umbau der neun
 * Konsumenten aus Recherche-Abschnitt 1.8 auf diese Funktion ist W4, nicht Teil dieser PR — hier
 * entsteht nur die Datenfunktion.
 */
export function getSeasonDisciplinePlayerCounts(
  gameState: GameState,
  disciplineId: string,
): SeasonDisciplinePlayerCountOccurrence[] {
  const occurrences: SeasonDisciplinePlayerCountOccurrence[] = [];

  for (const entry of getSeasonDisciplineSchedule(gameState)) {
    for (const slot of [entry.discipline1, entry.discipline2]) {
      if (slot?.disciplineId !== disciplineId) {
        continue;
      }
      occurrences.push({
        matchdayId: entry.matchdayId,
        matchdayIndex: entry.matchdayIndex,
        playerCount: slot.playerCount ?? null,
        occurrenceInSeason: slot.occurrenceInSeason ?? null,
      });
    }
  }

  return occurrences.sort((left, right) => left.matchdayIndex - right.matchdayIndex);
}

export function withNormalizedSeasonDisciplineSchedule(gameState: GameState, saveId?: string | null): GameState {
  const normalizedSchedule = getSeasonDisciplineSchedule(gameState, { saveId });
  const normalizedMatchdayIds = normalizedSchedule.map((entry) => entry.matchdayId);
  const fallbackMatchdayId =
    normalizedMatchdayIds[Math.max(0, Math.min(gameState.season.currentMatchday - 1, normalizedMatchdayIds.length - 1))] ??
    normalizedMatchdayIds[0] ??
    gameState.matchdayState.matchdayId;
  const activeMatchdayId = normalizedMatchdayIds.includes(gameState.matchdayState.matchdayId)
    ? gameState.matchdayState.matchdayId
    : fallbackMatchdayId;
  const activeMatchdayIndex = Math.max(
    1,
    normalizedMatchdayIds.findIndex((matchdayId) => matchdayId === activeMatchdayId) + 1,
  );

  return {
    ...gameState,
    season: {
      ...gameState.season,
      currentMatchday: activeMatchdayIndex,
      matchdayIds: normalizedMatchdayIds,
    },
    seasonState: {
      ...gameState.seasonState,
      disciplineSchedule: normalizedSchedule,
    },
    matchdayState: {
      ...gameState.matchdayState,
      matchdayId: activeMatchdayId,
    },
  };
}

/**
 * Ist der Spieltag WIRKLICH fertig -- beide geplanten Disziplin-Seiten gebucht, nicht nur
 * eine? `matchdayResults` bekommt schon nach einem D1-Teil-Commit eine Zeile (die Arena
 * bucht D1 und D2 einzeln, siehe legacy-matchday-result-apply-service.ts `commitThroughSide`)
 * -- eine reine "existiert ein Ergebnis?"-Pruefung haelt einen halben Spieltag deshalb faelschlich
 * fuer abgeschlossen.
 *
 * Genau diese Luecke liess sich ausnutzen: Wird "Zum naechsten Spieltag" nach D1 allein
 * ausgeloest (Doppelklick, Reload waehrend D2 laedt, oder schlicht weil der Schritt dafuer
 * bereits als "ready" markiert war), bucht der Spieltagswechsel D2 NIE nach -- der naechste
 * Spieltag ist schon aktiv, D2 laesst sich aus der normalen Ansicht nicht mehr nachholen.
 * Alle Spieler, die in D2 eingesetzt waren, verlieren damit den `playerDisciplinePerformances`-
 * Eintrag fuer genau diesen Spieltag: `buildPlayerSeasonPerformance` zaehlt `appearances` direkt
 * aus dieser Liste (player-season-performance.ts), der Wert bleibt fuer immer zu niedrig -- ohne
 * dass irgendwo eine falsche Spieler-Identitaet im Spiel war.
 *
 * Diese Funktion ist die EINZIGE Quelle fuer "Ergebnis vollstaendig?" auf Client (game-flow-
 * controller.ts) und Server (matchday-progress-service.ts) -- vorher hatten beide ihre eigene,
 * zu grosszuegige `matchdayResults.some(...)`-Pruefung.
 */
export function isMatchdayResultFullyCommitted(gameState: GameState, matchdayId: string): boolean {
  return getMatchdayScoringProgress(gameState, matchdayId).completion === "complete";
}

export type MatchdayScoringSideProgress = {
  /** Geplante Disziplin dieser Seite (aus dem Spielplan; notfalls aus den gebuchten Zeilen). */
  disciplineId: string | null;
  displayName: string | null;
  /** Steht die Seite ueberhaupt im Spielplan dieses Spieltags? */
  required: boolean;
  /** Sind fuer die Seite Disziplin-Ergebnisse im Save gebucht? */
  scored: boolean;
};

export type MatchdayScoringProgress = {
  /** Existiert eine `matchdayResults`-Zeile (auch fuer einen erst halb gebuchten Spieltag)? */
  hasResult: boolean;
  d1: MatchdayScoringSideProgress;
  d2: MatchdayScoringSideProgress;
  /**
   * none     → kein Ergebnis gebucht (Spieltag steht noch bevor).
   * partial  → mindestens eine geplante Seite fehlt noch (typisch: D1 gebucht, D2 offen).
   * complete → alle geplanten Seiten sind gebucht.
   */
  completion: "none" | "partial" | "complete";
};

/**
 * DIE eine Zustandsfrage des Spieltags — dreiwertig statt boolesch.
 *
 * `matchdayResults` bekommt schon nach dem D1-Teil-Commit eine Zeile (die Arena bucht D1 und
 * D2 einzeln); "es gibt ein Ergebnis" und "der Spieltag ist fertig" sind deshalb ZWEI
 * verschiedene Aussagen, und der Zustand dazwischen ("teilweise gewertet") ist ein normaler
 * Spielzustand, kein Fehlerfall. Spielplan, Arena und Spieltagsergebnis lesen diesen Zustand
 * hier — nicht jeweils eine eigene, zweiwertige Naeherung, die den halben Spieltag mal als
 * "fertig" (Ergebnis-Seite) und mal als "nichts gestartet" (Arena nach Reload) erzaehlt.
 */
export function getMatchdayScoringProgress(gameState: GameState, matchdayId: string): MatchdayScoringProgress {
  const result = (gameState.seasonState.matchdayResults ?? []).find(
    (entry) => entry.seasonId === gameState.season.id && entry.matchdayId === matchdayId,
  );

  const scheduleEntry = getSeasonDisciplineScheduleEntry(gameState, matchdayId);
  const resultRows = result
    ? (gameState.seasonState.disciplineResults ?? []).filter((entry) => entry.matchdayResultId === result.id)
    : [];
  const scoredRowFor = (side: "d1" | "d2") => resultRows.find((entry) => entry.disciplineSide === side) ?? null;
  const disciplineNameById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline.name] as const));

  const buildSide = (side: "d1" | "d2"): MatchdayScoringSideProgress => {
    const slot = side === "d1" ? scheduleEntry?.discipline1 : scheduleEntry?.discipline2;
    const scoredRow = scoredRowFor(side);
    const disciplineId = slot?.disciplineId ?? scoredRow?.disciplineId ?? null;
    return {
      disciplineId,
      displayName:
        slot?.displayName ?? (disciplineId ? disciplineNameById.get(disciplineId) ?? disciplineId : null),
      required: Boolean(slot?.disciplineId),
      scored: scoredRow != null,
    };
  };
  const d1 = buildSide("d1");
  const d2 = buildSide("d2");

  let completion: MatchdayScoringProgress["completion"];
  if (!result) {
    completion = "none";
  } else {
    const requiredSides = [d1, d2].filter((side) => side.required);
    // Ohne (oder mit unvollstaendigem) Schedule bleibt es bei der alten, grosszuegigen Regel --
    // sonst haengt ein Altstand ohne `disciplineSchedule` unbegruendet fest.
    completion = requiredSides.length === 0 || requiredSides.every((side) => side.scored) ? "complete" : "partial";
  }

  return { hasResult: Boolean(result), d1, d2, completion };
}
