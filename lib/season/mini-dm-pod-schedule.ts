/**
 * MINI-DM VIERERGRUPPEN (PODS) — additiv, parallel zu `Fixture`/`RoundPairing`, ohne deren Form
 * zu aendern (Chris' Entscheidung, 14.09., "mini-dm-spielplan-verankerung": "additiver, zum
 * bestehenden Modell paralleler Datensatz", NICHT eine Erweiterung von `Fixture` selbst — siehe
 * docs/design/mini-dm-4-team-ffa-recherche-06-09.md Abschnitt 5 und
 * docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md Abschnitt 5.1/7 fuer die Begruendung,
 * warum `Fixture`/`buildCircleRounds()`/`getOpponentOf()` hart-paarweise bleiben MUESSEN, statt
 * N-breit umgebaut zu werden.
 *
 * FORM DER ENTSCHEIDUNG (bewusst NICHT persistiert):
 * Ein `MiniDmPod` wird rein aus bereits vorhandenen, persistierten Fakten ABGELEITET —
 * `leagueByTeamId` (Liga-Zugehoerigkeit, `league-split.ts`), der Saison-/Save-Identitaet und
 * `occurrenceInSeason` aus dem Disziplin-Spielplan (`season-discipline-schedule.ts`) — GENAU WIE
 * `getSeasonDisciplineSchedule()` selbst bei einem unvollstaendigen `disciplineSchedule` neu
 * rechnet, statt sich auf einen gespeicherten Zustand zu verlassen. Kein neues Feld in
 * `SeasonState`/`GameState` noetig: nichts an Persistenz, Migration oder Save-Kompatibilitaet
 * aendert sich fuer einen einzigen bestehenden Spielstand. Ein Aufrufer, der Pods braucht, ruft
 * `getMiniDmPodsForMatchday()` auf, wie ein Aufrufer, der den Spielplan braucht,
 * `getSeasonDisciplineSchedule()` aufruft.
 *
 * BILDUNG (Entscheidung 3, additiver Weg statt N-breitem `Fixture`-Umbau): `buildCircleRounds()`
 * (season-fixture-schedule.ts, UNVERAENDERT wiederverwendet — dieselbe bereits korrekte, bereits
 * getestete Paarungslogik, die auch die normalen 2er-Fixtures erzeugt) laeuft auf einer EIGENEN,
 * pod-spezifisch geseedeten Team-Permutation je Liga UND je Saison-Vorkommen (1. oder 2.
 * Mini-DM-Spieltag). Die erste Runde dieser Permutation (bei LEAGUE_SIZE=16 acht Paare) wird
 * paarweise zu vier Pods verschmolzen: Paar 0+1 -> Pod 0, Paar 2+3 -> Pod 1, usw. (die
 * "{A-B}+{C-D} -> Pod{A,B,C,D}"-Verschmelzung aus der Recherche). Der Seed traegt
 * `occurrenceInSeason` explizit -- Vorkommen 1 und 2 ziehen dadurch GARANTIERT unterschiedliche
 * Team-Permutationen und damit unterschiedliche Vierergruppen (Chris' Entscheidung: neu wuerfeln
 * statt derselben Gruppierung).
 *
 * WARUM EINE EIGENE PERMUTATION STATT DER RUNDE, DIE `buildSeasonFixtureSchedule()` FUER
 * DENSELBEN SPIELTAG SOWIESO SCHON ZIEHT: Erstens haelt das Mini-DMs Pod-Bildung vollstaendig
 * unabhaengig von der normalen Fixture-Erzeugung -- ein kuenftiger Umbau von
 * `buildSeasonFixtureSchedule()` (z. B. eine andere Rundenreihenfolge) kann diese Datei dadurch
 * nie stillschweigend mitveraendern. Zweitens macht es Entscheidung 2 ("beim zweiten Vorkommen neu
 * wuerfeln") beweisbar statt bloss wahrscheinlich: die normale Fixture-Runde eines Spieltags haengt
 * an `(offset + matchdayIndex) % totalRounds` (`season-fixture-schedule.ts`) -- bei 20
 * Battle-Mode-Spieltagen und nur 15 eindeutigen Runden (LEAGUE_SIZE=16) wickelt das nachweislich um
 * (Audit Abschnitt 6a), zwei Mini-DM-Spieltage KOENNTEN also zufaellig dieselbe Runde treffen. Der
 * eigene Seed hier schliesst das aus, ohne von diesem bekannten Rand-Effekt abzuhaengen.
 *
 * SQUASH-VORAUSSETZUNG: LEAGUE_SIZE (und TEAM_COUNT_TOTAL im Legacy-32er-Modus) sind fest auf
 * Vielfache von 4 gesetzt (Chris' Entscheidung 1, 14.09.) -- eine Liga von 16 Teams zerfaellt daher
 * IMMER restlos in vier Pods zu je vier Teams, ohne Trio/Bye-Sonderfall. Diese Datei baut deshalb
 * bewusst KEINE Restbehandlung: eine Liga, deren Groesse nicht durch 4 teilbar ist, lässt den
 * letzten, unvollstaendigen Rest der ersten Runde unberuecksichtigt (kein Pod, keine Exception) --
 * das ist eine bewusste Vereinfachung, keine unbemerkte Luecke, siehe `buildMiniDmPodGroups()`.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getSeasonDisciplineSchedule, MINI_DM_DISCIPLINE_ID } from "@/lib/season/season-discipline-schedule";
import { buildCircleRounds } from "@/lib/season/season-fixture-schedule";
import { getLeagueTeamIds, isLeagueSplitActive, type LeagueTier } from "@/lib/season/league-split";

// Dasselbe seeded-RNG-Muster wie in season-fixture-schedule.ts/season-discipline-schedule.ts --
// absichtlich noch einmal dupliziert statt importiert (season-fixture-schedule.ts-Kopfkommentar:
// "das Muster lebt bereits mehrfach im Repo [...] ohne gemeinsames Util-Modul" -- diese Datei folgt
// demselben, bereits etablierten Vorbild statt eine neue Abhaengigkeit einzuziehen). NUR
// `buildCircleRounds()` selbst wird importiert, nicht neu geschrieben (Kopfkommentar oben).
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

function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
  const next = [...items];
  const random = createSeededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export type MiniDmPod = {
  id: string;
  seasonId: string;
  matchdayId: string;
  /** `null` im Legacy-32er-Modus ohne Liga-Split (`isLeagueSplitActive() === false`) -- dort bildet
   *  sich EIN Pool aus allen `TEAM_COUNT_TOTAL` Teams statt zwei ligagetrennter Pools. */
  leagueTier: LeagueTier | null;
  /** Welches der (bei Battle-Mode-Repeat) zwei Saison-Vorkommen von Mini-DM dieser Pod bedient. */
  occurrenceInSeason: 1 | 2;
  teamIds: [string, string, string, string];
};

/**
 * Reine Funktion: eine Menge Team-IDs -> Liste von Vierer-Pods, per `buildCircleRounds()` auf
 * einer mit `seed` geseedeten Permutation dieser Team-IDs. Team-IDs, die durch 4 nicht restlos
 * aufgehen, bleiben in KEINEM Pod (bewusste Vereinfachung, s. Datei-Kopfkommentar) -- bei
 * `teamIds.length` als Vielfachem von 4 (jede heutige Liga, s. `LEAGUE_SIZE`/`TEAM_COUNT_TOTAL`)
 * bleibt kein Team uebrig.
 */
export function buildMiniDmPodGroups(teamIds: readonly string[], seed: string): string[][] {
  if (teamIds.length < 4) {
    return [];
  }
  const permuted = shuffleSeeded(teamIds, `${seed}:teams`);
  const rounds = buildCircleRounds(permuted);
  const firstRound = rounds[0] ?? [];
  const pods: string[][] = [];
  for (let index = 0; index + 1 < firstRound.length; index += 2) {
    const first = firstRound[index]!;
    const second = firstRound[index + 1]!;
    pods.push([first.homeTeamId, first.awayTeamId, second.homeTeamId, second.awayTeamId]);
  }
  return pods;
}

function getMiniDmTeamPools(gameState: GameState): Array<{ tier: LeagueTier | null; teamIds: string[] }> {
  if (isLeagueSplitActive(gameState)) {
    return (["liga1", "liga2"] as const).map((tier) => ({ tier, teamIds: getLeagueTeamIds(gameState, tier) }));
  }
  // Legacy-32er-Modus (kein Liga-Split): ein einziger Pool aus allen Teams des Saves --
  // TEAM_COUNT_TOTAL (32) ist ebenfalls ein Vielfaches von 4 (Chris' Entscheidung 1).
  return [{ tier: null, teamIds: gameState.teams.map((team) => team.teamId) }];
}

/**
 * Ist `matchdayId` ein Mini-DM-Spieltag (D1 oder D2), UND welches Saison-Vorkommen ist es -- oder
 * `null`, wenn Mini-DM an diesem Spieltag gar nicht laeuft.
 */
function findMiniDmOccurrenceForMatchday(gameState: GameState, matchdayId: string): 1 | 2 | null {
  const entry = getSeasonDisciplineSchedule(gameState).find((candidate) => candidate.matchdayId === matchdayId);
  if (!entry) {
    return null;
  }
  const slot = [entry.discipline1, entry.discipline2].find((candidate) => candidate?.disciplineId === MINI_DM_DISCIPLINE_ID);
  if (!slot) {
    return null;
  }
  return slot.occurrenceInSeason ?? 1;
}

/**
 * Die Mini-DM-Vierergruppen fuer EINEN Spieltag -- leer, wenn Mini-DM an diesem Spieltag nicht
 * laeuft (jeder andere Spieltag, also die weit ueberwiegende Mehrheit) oder eine Liga/der
 * Legacy-Pool nicht durch 4 teilbar ist. Deterministisch fuer denselben
 * (saveId, seasonId, matchdayId, leagueByTeamId, occurrenceInSeason) -- wiederholte Aufrufe (z. B.
 * einmal fuers Spielplan-UI, einmal fuer den Headless-Runner) liefern dieselben vier Teams je Pod.
 */
export function getMiniDmPodsForMatchday(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
): MiniDmPod[] {
  const occurrenceInSeason = findMiniDmOccurrenceForMatchday(gameState, matchdayId);
  if (occurrenceInSeason == null) {
    return [];
  }

  const saveId = options?.saveId ?? "normalized-local-save";
  const seasonId = gameState.season.id;
  const pods: MiniDmPod[] = [];

  for (const pool of getMiniDmTeamPools(gameState)) {
    if (pool.teamIds.length < 4) {
      continue;
    }
    const tierLabel = pool.tier ?? "legacy-pool";
    const seed = `${saveId}:${seasonId}:mini-dm-pods-v1:${tierLabel}:occurrence-${occurrenceInSeason}`;
    const groups = buildMiniDmPodGroups(pool.teamIds, seed);
    groups.forEach((teamIds, podIndex) => {
      pods.push({
        id: `minidm-pod:${seasonId}:${tierLabel}:${matchdayId}:${podIndex}`,
        seasonId,
        matchdayId,
        leagueTier: pool.tier,
        occurrenceInSeason,
        teamIds: teamIds as [string, string, string, string],
      });
    });
  }

  return pods;
}

/** Der Pod eines konkreten Teams an einem Spieltag -- `null`, wenn keiner existiert (Team nicht in
 *  Mini-DMs Spieltag involviert, oder gar kein Mini-DM-Spieltag). */
export function getMiniDmPodForTeam(
  gameState: GameState,
  teamId: string,
  matchdayId: string,
  options?: { saveId?: string | null },
): MiniDmPod | null {
  return getMiniDmPodsForMatchday(gameState, matchdayId, options).find((pod) => pod.teamIds.includes(teamId)) ?? null;
}
