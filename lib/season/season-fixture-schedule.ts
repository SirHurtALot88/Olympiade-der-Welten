/**
 * FIXTURE-/SPIELPLAN-GENERATOR — PR 2 aus docs/design/liga-split-plan.md, Abschnitt 5.
 *
 * Circle-Methode (Standard-Round-Robin) je Liga: LEAGUE_SIZE (16) Teams -> LEAGUE_SIZE-1 (15)
 * eindeutige Runden a LEAGUE_SIZE/2 (8) Paarungen, in denen jedes Team gegen jedes andere genau
 * einmal antritt. Die Saison nutzt so viele Runden, wie `matchdayIds` lang ist (heute
 * `getRequiredSeasonDisciplineMatchdayCount()`, 10) — bei 10 von 15 moeglichen Runden bleiben pro
 * Saison 5 Gegner ungespielt. Von Chris akzeptiert (Plan Abschnitt 10.1): ueber mehrere Saisons
 * rotieren die verpassten Gegner durch den seasonId-Anteil des Seeds.
 *
 * Seed `${saveId}:${seasonId}:fixtures-v1:${leagueTier}` bestimmt deterministisch:
 *  - eine Team-Permutation VOR dem Circle-Aufbau (welche Teams als "Nachbarn" in welcher Runde
 *    aufeinandertreffen),
 *  - einen Runden-Offset 0..(Runden-1) (welche 10 der 15 Runden gespielt werden).
 *
 * Dasselbe seeded-RNG-Muster wie lib/season/season-discipline-schedule.ts (hashToUint /
 * createSeededRandom / shuffleSeeded) — absichtlich hier dupliziert statt importiert: das Muster
 * lebt bereits mehrfach im Repo (season-economy-factors.ts, player-potential-display-service.ts)
 * ohne gemeinsames Util-Modul, also folgt diese Datei demselben, bereits etablierten Vorbild statt
 * eine neue Abhaengigkeit zwischen den beiden Season-Schedule-Dateien einzuziehen.
 *
 * Die Paarung aendert KEINE Punkte (Formel bleibt identisch, Chris-Vorgabe) — sie ist reine
 * Anzeige-/Erzaehl-Schicht fuer den Spielplan-Tab (Abschnitt 6).
 *
 * Fuer Legacy-Saves (isLeagueSplitActive() === false, 32 Teams) bleibt `buildSeasonFixtures()` in
 * lib/season/preseason-workflow-service.ts (Dummy-Paarung `teamIds[i % n]` vs. `teamIds[(i+1) % n]`)
 * unveraendert im Einsatz — dieser Generator kommt nur zum Zug, wenn der Liga-Split aktiv ist.
 */
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import type { LeagueTier } from "@/lib/season/league-split";
import { LEAGUE_SIZE } from "@/lib/season/league-split";

const LEAGUE_TIERS: readonly LeagueTier[] = ["liga1", "liga2"];

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

type RoundPairing = { homeTeamId: string; awayTeamId: string };

/**
 * Circle-Methode: n Teams (n gerade) -> n-1 Runden a n/2 Paarungen, jede der C(n,2) Paarungen genau
 * einmal ueber alle Runden hinweg. Team 0 bleibt fix, der Rest rotiert eine Position je Runde.
 * Heim/Auswaerts alterniert je Runde, damit nicht dieselbe Haelfte immer "Heim" traegt — hat keinen
 * Effekt auf Scoring (das bleibt liga-lokales Renn-Scoring je Disziplin, nicht Duell-Scoring).
 */
function buildCircleRounds(teamIds: readonly string[]): RoundPairing[][] {
  const n = teamIds.length;
  if (n < 2) {
    return [];
  }

  const fixed = teamIds[0]!;
  let rotating = teamIds.slice(1);
  const rounds: RoundPairing[][] = [];

  const pairsPerRound = Math.floor(n / 2);
  for (let round = 0; round < n - 1; round += 1) {
    const roundTeams = [fixed, ...rotating];
    const pairs: RoundPairing[] = [];
    for (let i = 0; i < pairsPerRound; i += 1) {
      const left = roundTeams[i]!;
      const right = roundTeams[n - 1 - i]!;
      const [homeTeamId, awayTeamId] = round % 2 === 0 ? [left, right] : [right, left];
      pairs.push({ homeTeamId, awayTeamId });
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, rotating.length - 1)];
  }

  return rounds;
}

export type BuildSeasonFixtureScheduleInput = {
  saveId: string;
  seasonId: string;
  matchdayIds: string[];
  /** Team-IDs je Liga — je LEAGUE_SIZE (16) Eintraege erwartet, siehe getLeagueTeamIds(). */
  leagueTeamIds: Record<LeagueTier, string[]>;
};

export type BuildSeasonFixtureScheduleResult = {
  fixtures: Fixture[];
  warnings: string[];
};

/**
 * Baut den kompletten Saison-Spielplan (beide Ligen) ueber die Circle-Methode. Deterministisch fuer
 * denselben (saveId, seasonId, matchdayIds, leagueTeamIds) — siehe Datei-Kommentar fuer den Seed.
 */
export function buildSeasonFixtureSchedule(input: BuildSeasonFixtureScheduleInput): BuildSeasonFixtureScheduleResult {
  const warnings: string[] = [];
  const fixtures: Fixture[] = [];

  for (const tier of LEAGUE_TIERS) {
    const teamIds = input.leagueTeamIds[tier] ?? [];
    if (teamIds.length !== LEAGUE_SIZE) {
      warnings.push(`fixture_schedule_league_size_mismatch:${tier}:${teamIds.length}`);
    }
    if (teamIds.length < 2) {
      continue;
    }

    const seed = `${input.saveId}:${input.seasonId}:fixtures-v1:${tier}`;
    const permutedTeamIds = shuffleSeeded(teamIds, `${seed}:teams`);
    const rounds = buildCircleRounds(permutedTeamIds);
    const totalRounds = rounds.length;
    if (totalRounds === 0) {
      continue;
    }

    if (input.matchdayIds.length > totalRounds) {
      warnings.push(
        `fixture_schedule_matchday_count_exceeds_rounds:${tier}:${input.matchdayIds.length}:${totalRounds}`,
      );
    }

    const offsetRandom = createSeededRandom(`${seed}:offset`);
    const offset = Math.floor(offsetRandom() * totalRounds);

    input.matchdayIds.forEach((matchdayId, index) => {
      const roundIndex = (offset + index) % totalRounds;
      const pairs = rounds[roundIndex] ?? [];
      pairs.forEach((pair, pairIndex) => {
        fixtures.push({
          id: `fixture:${input.seasonId}:${tier}:${matchdayId}:${pairIndex}`,
          homeTeamId: pair.homeTeamId,
          awayTeamId: pair.awayTeamId,
          matchdayId,
          status: "scheduled",
          leagueTier: tier,
        });
      });
    });
  }

  return { fixtures, warnings: Array.from(new Set(warnings)) };
}

/** Der Gegner eines Teams an einem Spieltag — `null` ohne Spielplan-Eintrag (z. B. Legacy-Dummy-Spielplan ohne diese Paarung, oder Spieltag unbekannt). */
export function getOpponentOf(
  gameState: { seasonState: Pick<GameState["seasonState"], "schedule"> },
  teamId: string,
  matchdayId: string,
): string | null {
  const fixture = (gameState.seasonState.schedule ?? []).find(
    (entry) => entry.matchdayId === matchdayId && (entry.homeTeamId === teamId || entry.awayTeamId === teamId),
  );
  if (!fixture) {
    return null;
  }
  return fixture.homeTeamId === teamId ? fixture.awayTeamId : fixture.homeTeamId;
}
