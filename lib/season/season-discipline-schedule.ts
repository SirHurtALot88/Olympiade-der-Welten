import type {
  DisciplineCategory,
  Discipline,
  GameState,
  Matchday,
  PlayMode,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSlot,
} from "@/lib/data/olyDataTypes";

const SCHEDULE_SOURCE_NOTE =
  "Legacy-Fallback fuer alte Saves ohne vollstaendigen Season-Schedule.";

/**
 * Schedule-Version des Battle-Modus. Sie geht in den Seed ein
 * (`${saveId}:${seasonId}:${scheduleVersion}`) und trennt die Auslosung damit sauber von der des
 * Management-Modus: derselbe Save-/Saison-Schluessel wuerde sonst in beiden Spielarten dieselbe
 * erste Haelfte auswuerfeln.
 */
export const BATTLE_MODE_SCHEDULE_VERSION = "battle-mode-v1-double-round";

/** Fehlt die Spielart, ist es "management" — siehe `PlayMode` in olyDataTypes.ts. */
export function resolvePlayMode(playMode?: PlayMode | null): PlayMode {
  return playMode === "battle" ? "battle" : "management";
}

type ScheduledDiscipline = {
  discipline: Discipline;
  playerCount: number;
};

function toScheduleSlot(discipline: Discipline | null, playerCountOverride?: number | null): SeasonDisciplineScheduleSlot | null {
  if (!discipline) {
    return null;
  }

  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: playerCountOverride ?? discipline.playerCount ?? null,
    category: discipline.category,
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

/**
 * Der Zufallsgeber der Spielplanung — exportiert, damit die Battle-Paarungen
 * (`lib/season/battle-mode-spielplan.ts`) DIESELBE Quelle benutzen und nicht eine zweite,
 * eigene erfinden. Ein Save-Spielplan darf nur an einem Seed haengen, nicht an zwei.
 */
export function createSeededRandom(seed: string) {
  let state = hashToUint(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: T[], seed: string) {
  const next = [...items];
  const random = createSeededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function clampPlayerCount(value: number) {
  return Math.max(2, Math.min(6, Math.round(value)));
}

function buildSeasonPlayerCount(discipline: Discipline, seed: string) {
  const random = createSeededRandom(`${seed}:players:${discipline.id}`);
  const rolled = 2 + Math.floor(random() * 5);
  if (Number.isFinite(discipline.playerCount ?? NaN)) {
    const base = clampPlayerCount(discipline.playerCount ?? rolled);
    if (rolled === base) {
      const direction = random() >= 0.5 ? 1 : -1;
      return clampPlayerCount(base + direction);
    }
  }
  return clampPlayerCount(rolled);
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

function buildSeededDisciplinePairs(input: {
  disciplines: Discipline[];
  seed: string;
  requiredMatchdays: number;
  maxCombinedPlayerCount: number;
  /**
   * Vorgegebene Spielerzahlen je Disziplin. Nur der Battle-Modus reicht sie ein: dort laeuft
   * dieselbe Paarung ZWEIMAL mit unterschiedlichem Seed (zwei Saisonhaelften), und ohne diese
   * Vorgabe wuerfelte `buildSeasonPlayerCountByDiscipline` je Haelfte eine ANDERE Spielerzahl
   * fuer dieselbe Disziplin aus — Basketball waere im ersten Auftritt ein 6er und im zweiten ein
   * 3er. Die Spielerzahl gehoert der Saison, nicht dem einzelnen Spieltag.
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

/** Ungeordneter Schluessel einer Disziplin-Paarung — Basketball+Schach = Schach+Basketball. */
function disziplinPaarSchluessel(pair: [ScheduledDiscipline | null, ScheduledDiscipline | null]): string | null {
  const first = pair[0]?.discipline.id ?? null;
  const second = pair[1]?.discipline.id ?? null;
  if (!first || !second) {
    return null;
  }
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/**
 * Wie oft darf die zweite Saisonhaelfte neu gewuerfelt werden, bis sie keine Paarung der ersten
 * wiederholt? Gerechnet fuer die reale Ligagroesse (20 Disziplinen, 10 Paarungen je Haelfte):
 * eine einzelne Paarung der zweiten Haelfte trifft mit 10/190 ≈ 5 % eine der schon vergebenen,
 * ein ganzer Wurf geht also mit rund (1 − 10/190)^10 ≈ 58 % glatt durch. 40 Versuche scheitern
 * demnach mit ~0,42^40 ≈ 10^-15 — die Ersatzregel unten ist der Vollstaendigkeit halber da, nicht
 * weil sie erwartet wird.
 */
const BATTLE_MODE_MAX_PAAR_VERSUCHE = 40;

/**
 * DIE DOPPELRUNDE — jede Disziplin ZWEIMAL pro Saison, aber nie dieselbe Kombination zweimal.
 *
 * Chris' Vorgabe fuer den Battle-Modus: 20 Spieltage à 2 Disziplinen = 40 Plaetze, verteilt auf
 * 20 Disziplinen ⇒ jede genau zweimal. Verboten ist nur die WIEDERHOLTE KOMBINATION: wenn
 * Basketball+Schach an einem Spieltag stand, muss Basketballs zweiter Auftritt einen anderen
 * Partner finden.
 *
 * KEIN NEUES VERFAHREN, sondern das bestehende zweimal: die Saison wird in zwei Haelften zerlegt
 * und jede Haelfte mit `buildSeededDisciplinePairs` ausgelost — genau der Algorithmus, der auch
 * den Management-Modus auslost. Jede Haelfte verbraucht den Pool einmal komplett; daraus folgt
 * ohne jede Zusatzpruefung: jede Disziplin genau zweimal, und INNERHALB einer Haelfte kann sich
 * keine Kombination wiederholen (jede Disziplin kommt dort nur einmal vor). Zu pruefen bleibt
 * damit einzig die Kollision ZWISCHEN den Haelften.
 *
 * VERWORFEN — der Pool aus 40 Eintraegen (jede Disziplin doppelt) in EINEM Lauf: dann laesst sich
 * "jede genau zweimal" nicht mehr aus dem Verbrauch ablesen, sondern muss eigens erzwungen werden,
 * und obendrein kann eine Disziplin an einem Spieltag gegen SICH SELBST gepaart werden. Zwei
 * Haelften geben beide Zusicherungen geschenkt.
 *
 * NEBENWIRKUNG, DIE WIR WOLLEN: weil jede Haelfte den Pool komplett verbraucht, faellt der zweite
 * Auftritt einer Disziplin immer in die zweite Saisonhaelfte. Die Auftritte liegen damit
 * zwangslaeufig weit auseinander statt an Spieltag 3 und 4.
 */
function buildBattleModeDisciplinePairs(input: {
  disciplines: Discipline[];
  seed: string;
  requiredMatchdays: number;
  maxCombinedPlayerCount: number;
}): { pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]>; warnings: string[] } {
  const playerCountByDisciplineId = buildSeasonPlayerCountByDiscipline(input.disciplines, input.seed);
  const ersteHaelfteMatchdays = Math.ceil(input.requiredMatchdays / 2);
  const zweiteHaelfteMatchdays = input.requiredMatchdays - ersteHaelfteMatchdays;

  const ersteHaelfte = buildSeededDisciplinePairs({
    disciplines: input.disciplines,
    seed: `${input.seed}:haelfte-1`,
    requiredMatchdays: ersteHaelfteMatchdays,
    maxCombinedPlayerCount: input.maxCombinedPlayerCount,
    playerCountByDisciplineId,
  });
  const belegteKombinationen = new Set(
    ersteHaelfte.pairs.map((pair) => disziplinPaarSchluessel(pair)).filter((key): key is string => key !== null),
  );

  let zweiteHaelfte = ersteHaelfte;
  let kollisionsWarnung: string | null = null;
  if (zweiteHaelfteMatchdays > 0) {
    let letzterWurf: typeof ersteHaelfte | null = null;
    let gefunden = false;
    for (let versuch = 1; versuch <= BATTLE_MODE_MAX_PAAR_VERSUCHE; versuch += 1) {
      const wurf = buildSeededDisciplinePairs({
        disciplines: input.disciplines,
        seed: `${input.seed}:haelfte-2:versuch-${versuch}`,
        requiredMatchdays: zweiteHaelfteMatchdays,
        maxCombinedPlayerCount: input.maxCombinedPlayerCount,
        playerCountByDisciplineId,
      });
      letzterWurf = wurf;
      const kollidiert = wurf.pairs.some((pair) => {
        const key = disziplinPaarSchluessel(pair);
        return key !== null && belegteKombinationen.has(key);
      });
      if (!kollidiert) {
        gefunden = true;
        break;
      }
    }
    zweiteHaelfte = letzterWurf ?? { pairs: [], warnings: [] };
    if (!gefunden) {
      kollisionsWarnung = "battle_mode_schedule_pair_collision_unresolved";
    }
  } else {
    zweiteHaelfte = { pairs: [], warnings: [] };
  }

  return {
    pairs: [...ersteHaelfte.pairs, ...zweiteHaelfte.pairs],
    warnings: Array.from(
      new Set([...ersteHaelfte.warnings, ...zweiteHaelfte.warnings, ...(kollisionsWarnung ? [kollisionsWarnung] : [])]),
    ),
  };
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
 * WIE VIELE SPIELTAGE TRAEGT DIE SAISON — abgeleitet aus dem Disziplin-Pool, nicht gesetzt.
 *
 * Management: 2 Disziplinen je Spieltag, jede Disziplin EINMAL ⇒ ceil(20/2) = 10 Spieltage.
 * Battle:     2 Disziplinen je Spieltag, jede Disziplin ZWEIMAL ⇒ 2 × ceil(20/2) = 20 Spieltage.
 *
 * Der Parameter ist bewusst OPTIONAL und steht hinten: jeder bestehende Aufrufer (alle im
 * Management-Modus) ruft weiter mit einem Argument auf und bekommt exakt dieselbe Zahl wie vorher.
 */
export function getRequiredSeasonDisciplineMatchdayCount(disciplines: Discipline[], playMode?: PlayMode | null) {
  const einfach = Math.max(1, Math.ceil(sortDisciplinesForSeasonSchedule(disciplines).length / 2));
  return resolvePlayMode(playMode) === "battle" ? einfach * 2 : einfach;
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
  playMode?: PlayMode | null;
}) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines, input.playMode);
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
  playMode?: PlayMode | null;
}) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines, input.playMode);
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
  /** Fehlt = "management" — der bisherige Weg, Zeichen fuer Zeichen unveraendert. */
  playMode?: PlayMode | null;
}): { entries: SeasonDisciplineScheduleEntry[]; matchdayIds: string[]; scheduleSeed: string; warnings: string[] } {
  const playMode = resolvePlayMode(input.playMode);
  const scheduleVersion =
    input.scheduleVersion ??
    (playMode === "battle" ? BATTLE_MODE_SCHEDULE_VERSION : "season-setup-v3-balanced-slot-buckets");
  const scheduleSeed = `${input.saveId}:${input.seasonId}:${scheduleVersion}`;
  const requiredMatchdays = Math.max(
    1,
    input.matchdayCount ?? getRequiredSeasonDisciplineMatchdayCount(input.disciplines, playMode),
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
  const paired =
    playMode === "battle"
      ? buildBattleModeDisciplinePairs({
          disciplines: input.disciplines,
          seed: scheduleSeed,
          requiredMatchdays,
          maxCombinedPlayerCount,
        })
      : buildSeededDisciplinePairs({
          disciplines: input.disciplines,
          seed: scheduleSeed,
          requiredMatchdays,
          maxCombinedPlayerCount,
        });
  // Im Battle-Modus deckt der Pool jeden Platz ZWEIMAL ab — die Warnung misst deshalb gegen die
  // Plaetze EINER Saisonhaelfte, sonst schluege sie bei einer voellig gesunden Auslosung an.
  const belegteSlots = playMode === "battle" ? requiredMatchdays : requiredMatchdays * 2;
  const warnings = [
    ...(input.disciplines.length < belegteSlots ? ["season_schedule_discipline_pool_smaller_than_slots"] : []),
    ...paired.warnings,
  ];

  const entries = matchdayIds.map((matchdayId, index) => {
    const [discipline1, discipline2] = paired.pairs[index] ?? [null, null];

    return {
      seasonId: input.seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: toScheduleSlot(discipline1?.discipline ?? null, discipline1?.playerCount ?? null),
      discipline2: toScheduleSlot(discipline2?.discipline ?? null, discipline2?.playerCount ?? null),
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
  const playMode = resolvePlayMode(gameState.playMode);
  const matchdayIds = buildNormalizedMatchdayIds({
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds: gameState.season.matchdayIds,
    playMode,
  });
  return buildSeasonSeededDisciplineSchedule({
    saveId,
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds,
    matchdayCount: matchdayIds.length,
    playMode,
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
      playMode: gameState.playMode,
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

export function buildSeasonDisciplinePlayerCountMap(gameState: GameState) {
  const playerCountByDisciplineId = new Map<string, number | null>();

  for (const entry of getSeasonDisciplineSchedule(gameState)) {
    const slots = [entry.discipline1, entry.discipline2];
    for (const slot of slots) {
      if (!slot?.disciplineId) {
        continue;
      }
      playerCountByDisciplineId.set(slot.disciplineId, slot.playerCount ?? null);
    }
  }

  for (const discipline of gameState.disciplines) {
    if (!playerCountByDisciplineId.has(discipline.id)) {
      playerCountByDisciplineId.set(discipline.id, discipline.playerCount ?? null);
    }
  }

  return playerCountByDisciplineId;
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
