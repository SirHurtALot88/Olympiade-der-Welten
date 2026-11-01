/**
 * VERALLGEMEINERT (01.11.): diese Datei bildet seit Battlefields Umstellung die Vierergruppen fuer
 * JEDE Disziplin in `VIERER_POD_DISCIPLINE_IDS` (season-discipline-schedule.ts), nicht mehr nur fuer
 * Mini-DM -- `getPodsForMatchday(gameState, matchdayId, disciplineId)` ist der disziplinneutrale
 * Einstieg, `getMiniDmPodsForMatchday()` ein duenner Wrapper darauf. Der Pod-Seed traegt fuer jede
 * Disziplin ausser Mini-DM die Disziplin-ID (s. `podSeedTeil()`); Mini-DMs Seed und Pod-IDs sind
 * unveraendert. Der Rest dieses Kopfkommentars beschreibt die (unveraenderte) Bildung am
 * urspruenglichen Mini-DM-Fall.
 *
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
import {
  getSeasonDisciplineSchedule,
  getSeasonDisciplineScheduleEntry,
  isViererPodDiscipline,
  MINI_DM_DISCIPLINE_ID,
} from "@/lib/season/season-discipline-schedule";
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

/**
 * EINE Vierergruppe EINER Pod-Disziplin (`VIERER_POD_DISCIPLINE_IDS`, season-discipline-schedule.ts)
 * an EINEM Spieltag. Der Name ist historisch (Mini-DM war bis 01.11. die einzige Pod-Disziplin) --
 * seit Battlefields Umstellung traegt jeder Pod seine `disciplineId` selbst; `ViererPod` ist der
 * disziplinneutrale Alias fuer neuen Code.
 */
export type MiniDmPod = {
  id: string;
  /** Die Pod-Disziplin, fuer die diese Gruppe gelost wurde (seit 01.11.; "mini-dm" oder "battlefield"). */
  disciplineId: string;
  seasonId: string;
  matchdayId: string;
  /** `null` im Legacy-32er-Modus ohne Liga-Split (`isLeagueSplitActive() === false`) -- dort bildet
   *  sich EIN Pool aus allen `TEAM_COUNT_TOTAL` Teams statt zwei ligagetrennter Pools. */
  leagueTier: LeagueTier | null;
  /** Welches der (bei Battle-Mode-Repeat) zwei Saison-Vorkommen der Disziplin dieser Pod bedient. */
  occurrenceInSeason: 1 | 2;
  teamIds: [string, string, string, string];
};

/** Disziplinneutraler Alias, s. `MiniDmPod`. */
export type ViererPod = MiniDmPod;

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
 * Steht `disciplineId` an `matchdayId` (D1 oder D2), UND welches Saison-Vorkommen ist es -- oder
 * `null`, wenn diese Disziplin an diesem Spieltag gar nicht laeuft.
 */
function findPodDisciplineOccurrenceForMatchday(gameState: GameState, matchdayId: string, disciplineId: string): 1 | 2 | null {
  const entry = getSeasonDisciplineSchedule(gameState).find((candidate) => candidate.matchdayId === matchdayId);
  if (!entry) {
    return null;
  }
  const slot = [entry.discipline1, entry.discipline2].find((candidate) => candidate?.disciplineId === disciplineId);
  if (!slot) {
    return null;
  }
  return slot.occurrenceInSeason ?? 1;
}

/**
 * Seed und Pod-ID je Pod-Disziplin. MINI-DM BLEIBT BYTE-IDENTISCH zum Stand vor der
 * Verallgemeinerung (01.11.): `mini-dm-pods-v1` ohne weiteren Disziplin-Teil und das Praefix
 * `minidm-pod:` -- bestehende Spielstaende kuendigen fuer kommende Mini-DM-Spieltage also exakt
 * dieselben Gruppen an wie vorher, und der FFA-Vorlauf (Pod-ID im Match-Seed, `buildMiniDmFfaPodMatchSeed`,
 * und im Eingabe-Hash) bleibt gueltig. JEDE ANDERE Pod-Disziplin bekommt ihre Disziplin-ID in den
 * Seed (Chris' Entscheidung 2, 01.11.: "je Disziplin-Event frisch gelost") -- ohne das zoegen alle
 * Pod-Disziplinen desselben Vorkommens dieselben vier Gruppen (Konzept 01.11., Abschnitt 3).
 */
function podSeedTeil(disciplineId: string): string {
  return disciplineId === MINI_DM_DISCIPLINE_ID ? "mini-dm-pods-v1" : `${disciplineId}-pods-v1`;
}

function podIdPraefix(disciplineId: string): string {
  return disciplineId === MINI_DM_DISCIPLINE_ID ? "minidm-pod" : `${disciplineId}-pod`;
}

/**
 * Die Vierergruppen EINER Pod-Disziplin fuer EINEN Spieltag -- leer, wenn `disciplineId` keine
 * Pod-Disziplin ist (`isViererPodDiscipline`), an diesem Spieltag nicht laeuft, oder eine Liga/der
 * Legacy-Pool nicht durch 4 teilbar ist. Deterministisch fuer denselben
 * (saveId, seasonId, matchdayId, disciplineId, leagueByTeamId, occurrenceInSeason) -- wiederholte
 * Aufrufe (Spielplan-UI, Resolve, Headless-Runner) liefern dieselben vier Teams je Pod.
 */
export function getPodsForMatchday(
  gameState: GameState,
  matchdayId: string,
  disciplineId: string,
  options?: { saveId?: string | null },
): MiniDmPod[] {
  if (!isViererPodDiscipline(disciplineId)) {
    return [];
  }
  const occurrenceInSeason = findPodDisciplineOccurrenceForMatchday(gameState, matchdayId, disciplineId);
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
    const seed = `${saveId}:${seasonId}:${podSeedTeil(disciplineId)}:${tierLabel}:occurrence-${occurrenceInSeason}`;
    const groups = buildMiniDmPodGroups(pool.teamIds, seed);
    groups.forEach((teamIds, podIndex) => {
      pods.push({
        id: `${podIdPraefix(disciplineId)}:${seasonId}:${tierLabel}:${matchdayId}:${podIndex}`,
        disciplineId,
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

/** Der Pod eines konkreten Teams in EINER Pod-Disziplin an einem Spieltag -- `null`, wenn keiner existiert. */
export function getPodForTeam(
  gameState: GameState,
  teamId: string,
  matchdayId: string,
  disciplineId: string,
  options?: { saveId?: string | null },
): MiniDmPod | null {
  return getPodsForMatchday(gameState, matchdayId, disciplineId, options).find((pod) => pod.teamIds.includes(teamId)) ?? null;
}

/**
 * Welche Pod-Disziplinen stehen an `matchdayId` (in Slot-Reihenfolge D1, D2)? Leer an fast jedem
 * Spieltag; zwei Eintraege, wenn zwei Pod-Disziplinen zusammenfallen (Chris 01.11.: erlaubt).
 */
export function getPodDisciplineSlotsForMatchday(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
): Array<{ disciplineId: string; displayName: string; disciplineSide: "d1" | "d2" }> {
  const entry = getSeasonDisciplineScheduleEntry(gameState, matchdayId, options);
  if (!entry) return [];
  const slots: Array<{ disciplineId: string; displayName: string; disciplineSide: "d1" | "d2" }> = [];
  for (const [slot, disciplineSide] of [
    [entry.discipline1, "d1"],
    [entry.discipline2, "d2"],
  ] as const) {
    if (slot && isViererPodDiscipline(slot.disciplineId)) {
      slots.push({ disciplineId: slot.disciplineId, displayName: slot.displayName, disciplineSide });
    }
  }
  return slots;
}

/**
 * Die Mini-DM-Vierergruppen fuer EINEN Spieltag -- duenner Wrapper um `getPodsForMatchday()`
 * (unveraenderte Signatur fuer die Mini-DM-FFA-Aufrufer: Vorlauf, Eingabe-Hash, Arena-Host).
 */
export function getMiniDmPodsForMatchday(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
): MiniDmPod[] {
  return getPodsForMatchday(gameState, matchdayId, MINI_DM_DISCIPLINE_ID, options);
}

/** Der Mini-DM-Pod eines konkreten Teams an einem Spieltag -- s. `getPodForTeam()`. */
export function getMiniDmPodForTeam(
  gameState: GameState,
  teamId: string,
  matchdayId: string,
  options?: { saveId?: string | null },
): MiniDmPod | null {
  return getPodForTeam(gameState, teamId, matchdayId, MINI_DM_DISCIPLINE_ID, options);
}

/**
 * DER SPIELPLAN-SLOT-K EINES MINI-DM-SPIELTAGS — `null`, wenn an diesem Spieltag gar kein
 * Mini-DM-Slot steht (D1 UND D2 sind etwas anderes) oder der Slot keine gueltige Kadergroesse
 * traegt. `legacyScorePlayerCount` zuerst (seit PR 1 der 2-6-Spieler-Rueckkehr, 21.10., IDENTISCH
 * zu `playerCount` fuer Mini-DM -- s. Kommentar an `SeasonDisciplineScheduleSlot.
 * legacyScorePlayerCount`, olyDataTypes.ts), `playerCount` als Rueckfall fuer einen aelteren,
 * noch nicht normalisierten Spielplan-Eintrag.
 *
 * HIERHER VERSCHOBEN (PR 6 des 6-PR-Opus-Plans 21.10., "Buehnen-Anzeige") statt in
 * `lib/resolve/mini-dm-ffa-matchday.ts` zu bleiben: diese Datei ist (wie dieser ganze
 * Modulkopf-Kommentar oben begruendet) bewusst OHNE Playwright-/`node:fs`-Importe, waehrend
 * `mini-dm-ffa-matchday.ts` ueber `arena-headless-runner.ts` beide mitzieht. Ein Next.js-
 * Client-Bundle (`FoundationBattleArenaHost.tsx`, "use client") braucht GENAU diese Funktion, um
 * die echte Kadergroesse k des Spieltags fuer die Live-Buehne zu lesen, OHNE Playwright/`fs`/
 * `net`/`tls` mitzuziehen (`Module not found`-Build-Fehler, s. `arena-resolved-disciplines.ts`-
 * Kopfkommentar fuer denselben Grund bei einer anderen Konstante). `mini-dm-ffa-matchday.ts`
 * importiert sie jetzt von hier zurueck (Re-Export), damit bestehende Importe/Tests unveraendert
 * weiterlaufen -- EINE Implementierung, zwei Aufrufer, kein zweiter Pfad.
 */
export function resolveMiniDmFfaPlayerCountForMatchday(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string | null },
): number | null {
  const entry = getSeasonDisciplineScheduleEntry(gameState, matchdayId, options);
  if (!entry) return null;
  const slot = [entry.discipline1, entry.discipline2].find((candidate) => candidate?.disciplineId === MINI_DM_DISCIPLINE_ID);
  if (!slot) return null;
  const k = slot.legacyScorePlayerCount ?? slot.playerCount ?? null;
  return Number.isInteger(k) && k != null && k >= 2 && k <= 6 ? k : null;
}
