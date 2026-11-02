/**
 * IN WELCHER LIGA SPIELTE TEAM X IN SAISON N? — die eine Lesestelle fuer historische Liga-Zugehoerigkeit.
 *
 * GEWUENSCHT VON CHRIS (02.11.): „gerade auch bei den Team- und den Spieler-Drawern, dass man dann
 * vielleicht noch hinzufuegt, in Season 1, in welcher Liga haben sie denn gespielt zu dem Zeitpunkt
 * […] ob die dann zu dem Zeitpunkt Liga 1, 2, 3, 4, 5 irgendwas waren, falls man es nochmal
 * erweitert, nur dass du da schon mal vorsorgst".
 *
 * WOHER DIE ANTWORT KOMMT, in dieser Reihenfolge:
 *
 *   1. EINGEFROREN IM SAISON-SCHNAPPSCHUSS. `createSeasonSnapshot` schreibt seit Task #158 (#1288,
 *      18.10.) je Team `leagueTier` in die Endtabelle — VOR `league_movement`, also mit der Liga, in
 *      der die Saison wirklich gespielt wurde. Im Browser (Schnappschuesse gestrichen) faehrt das
 *      Feld ueber die Kurzfassung `foundationSeasonHistory` mit. Ein explizites `null` heisst „in
 *      dieser Saison gab es keine Liga-Trennung" und wird nicht weiter hinterfragt.
 *
 *   2. ZURUECKGERECHNET aus der aktuellen Zuordnung (`seasonState.leagueByTeamId`) und den
 *      Auf-/Abstiegs-Protokollen (`seasonState.leagueMovementLogs`). Das deckt die laufende Saison
 *      ab (auch das Fenster nach `league_movement`, in dem `leagueByTeamId` schon die NAECHSTE Saison
 *      beschreibt) und jeden Schnappschuss, der das Feld noch nicht kannte. Jede Bewegung ist genau
 *      eine Stufe (Aufstieg: Stufe − 1, Abstieg: Stufe + 1); rueckwaerts wird sie umgekehrt.
 *
 *   3. SONST `null` — Manager Mode und jeder Legacy-Save ohne Liga-Split. Jede Anzeige blendet die
 *      Liga dann aus, genau wie `spieltagLigaLabel` im Saisonstand es fuer die laufende Saison tut.
 *
 * ZUKUNFTSSICHER: Liga-Kennungen folgen der bestehenden Konvention aus `league-split.ts`
 * (`"liga1"`, `"liga2"`) — hier aber als offenes Schema `liga<N>` gelesen, nie als Zweierliste.
 * Kommt eine Liga 3, 4, 5 dazu, laeuft Anzeige und Rueckrechnung ohne Aenderung weiter.
 */
import type { GameState, SeasonSnapshotRecord, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE, isLeagueSplitActive } from "@/lib/season/league-split";

/**
 * Eine Liga-Kennung im Schema `liga<N>`. Bewusst `string` statt `LeagueTier`: die Historie muss auch
 * Ligen lesen koennen, die der heutige Spielcode (noch) nicht kennt.
 */
export type HistoricalLeagueTier = string;

const LEAGUE_TIER_PATTERN = /^liga(\d+)$/i;

/** Stufe einer Liga: `"liga1"` → 1, `"liga2"` → 2, `"liga7"` → 7. `null` fuer alles andere. */
export function getLeagueLevel(tier: string | null | undefined): number | null {
  if (typeof tier !== "string") return null;
  const match = tier.trim().match(LEAGUE_TIER_PATTERN);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isInteger(level) && level >= 1 ? level : null;
}

/** Rueckrichtung zu `getLeagueLevel`: 3 → `"liga3"`. */
export function leagueTierForLevel(level: number): HistoricalLeagueTier {
  return `liga${Math.max(1, Math.trunc(level))}`;
}

/** `"liga1"` → `"Liga 1"`. Unbekanntes Schema wird unveraendert gezeigt statt verschluckt; leer → `null`. */
export function formatLeagueTierLabel(tier: string | null | undefined): string | null {
  const level = getLeagueLevel(tier);
  if (level != null) return `Liga ${level}`;
  return typeof tier === "string" && tier.trim().length > 0 ? tier.trim() : null;
}

/** `"liga1"` → `"L1"` — fuer Chips neben Saison/Team, analog zum `ranks-league-badge` im Ranks-Reiter. */
export function formatLeagueTierShortLabel(tier: string | null | undefined): string | null {
  const level = getLeagueLevel(tier);
  if (level != null) return `L${level}`;
  return formatLeagueTierLabel(tier);
}

/**
 * Ligauebergreifende Position fuer Verlaufslinien: Rang 1 in Liga 2 liegt HINTER Rang 16 in Liga 1.
 * Ohne Liga (Manager Mode) bleibt der Rang unveraendert.
 */
export function toLeagueSpanningPosition(
  rank: number | null | undefined,
  tier: string | null | undefined,
  leagueSize: number = LEAGUE_SIZE,
): number | null {
  if (rank == null || !Number.isFinite(rank)) return null;
  const level = getLeagueLevel(tier);
  return level == null ? rank : (level - 1) * leagueSize + rank;
}

export type HistoricalLeagueTierLookup = (
  seasonId: string | null | undefined,
  teamId: string | null | undefined,
) => HistoricalLeagueTier | null;

type FrozenTeamRecord = Pick<SeasonSnapshotTeamRecord, "teamId"> & { leagueTier?: string | null };

function compareSeasonIds(left: string, right: string): number {
  return left.localeCompare(right, "de", { numeric: true });
}

function collectFrozenTiers(
  target: Map<string, Map<string, string | null>>,
  seasonId: string,
  records: readonly FrozenTeamRecord[] | null | undefined,
) {
  for (const record of records ?? []) {
    if (!record?.teamId || !Object.prototype.hasOwnProperty.call(record, "leagueTier")) continue;
    const value = record.leagueTier;
    if (value !== null && typeof value !== "string") continue;
    let bySeason = target.get(seasonId);
    if (!bySeason) {
      bySeason = new Map();
      target.set(seasonId, bySeason);
    }
    // Ein gesetzter Wert schlaegt ein `null` aus einer zweiten Liste desselben Schnappschusses.
    if (!bySeason.has(record.teamId) || (bySeason.get(record.teamId) == null && value != null)) {
      bySeason.set(record.teamId, value);
    }
  }
}

/**
 * Baut die Nachschlage-Funktion EINMAL je Spielstand — alle Anzeigen fragen dann je Zeile nur noch
 * zwei Maps ab. Liefert `null`, wenn fuer diese Saison/dieses Team keine Liga bekannt ist oder es
 * keine Liga-Trennung gab.
 */
export function buildHistoricalLeagueTierLookup(gameState: GameState): HistoricalLeagueTierLookup {
  const frozen = new Map<string, Map<string, string | null>>();
  const snapshots: readonly SeasonSnapshotRecord[] = gameState.seasonState.seasonSnapshots ?? [];
  for (const snapshot of snapshots) {
    collectFrozenTiers(frozen, snapshot.seasonId, snapshot.finalStandings);
    collectFrozenTiers(frozen, snapshot.seasonId, snapshot.teamSnapshots);
  }
  for (const entry of gameState.seasonState.foundationSeasonHistory ?? []) {
    if (!frozen.has(entry.seasonId)) {
      collectFrozenTiers(frozen, entry.seasonId, entry.teams);
    }
  }

  const splitActive = isLeagueSplitActive(gameState);
  const currentByTeamId = gameState.seasonState.leagueByTeamId ?? {};
  const movementLogs = [...(gameState.seasonState.leagueMovementLogs ?? [])].sort((left, right) =>
    compareSeasonIds(right.seasonId, left.seasonId),
  );

  const reconstruct = (seasonId: string, teamId: string): HistoricalLeagueTier | null => {
    let level = getLeagueLevel(currentByTeamId[teamId]);
    if (level == null) return null;
    // Neueste Bewegung zuerst zuruecknehmen. Eine Bewegung NACH Saison S (Log mit seasonId >= S)
    // hat die Liga fuer S+1 geaendert, also gehoert sie fuer S rueckgaengig gemacht.
    for (const log of movementLogs) {
      if (compareSeasonIds(log.seasonId, seasonId) < 0) break;
      if (log.promotedTeamIds?.includes(teamId)) level += 1;
      else if (log.relegatedTeamIds?.includes(teamId)) level -= 1;
    }
    return level >= 1 ? leagueTierForLevel(level) : null;
  };

  return (seasonId, teamId) => {
    if (!seasonId || !teamId) return null;
    const bySeason = frozen.get(seasonId);
    if (bySeason?.has(teamId)) {
      return bySeason.get(teamId) ?? null;
    }
    return splitActive ? reconstruct(seasonId, teamId) : null;
  };
}

/** Bequemlichkeit fuer Einzelabfragen — wer viele Zeilen baut, nimmt `buildHistoricalLeagueTierLookup`. */
export function resolveHistoricalLeagueTier(
  gameState: GameState,
  seasonId: string | null | undefined,
  teamId: string | null | undefined,
): HistoricalLeagueTier | null {
  return buildHistoricalLeagueTierLookup(gameState)(seasonId, teamId);
}
