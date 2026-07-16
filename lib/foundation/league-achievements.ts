import type { GameState, StandingRecord } from "@/lib/data/olyDataTypes";
import type { LeagueLeaderCategory } from "@/lib/foundation/league-leaders-service";
import { buildOwnTeamLeaderboardFootprint, buildTeamSquadMarketValues } from "@/lib/foundation/league-season-bests";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { formatNlNumber, type NlTone } from "@/components/foundation/new-look/nl-tones";

/**
 * D6 — "Erfolge / Meilensteine" (fog-safe, read-time).
 *
 * Alle Meilensteine werden zur Renderzeit aus `gameState` + den bereits
 * berechneten Leaderboard-Kategorien abgeleitet — keine neue Spiel-Logik,
 * keine Persistenz. Fog-of-War: es werden ausschließlich öffentliche Metriken
 * des Manager-Teams (eigene Kader-OVR/Marktwert, öffentliche Ranglisten-Slots,
 * Tabellenplatz, eigene Transfers, archivierte Endstände) betrachtet. Fremdes
 * verstecktes Potenzial wird nie gelesen.
 *
 * Erreichte Meilensteine bekommen einen Kontext (Wert/Spieler) und — wo aus den
 * Season-Snapshots ableitbar — die Saison, in der sie erreicht wurden. Noch
 * offene Meilensteine erscheinen gesperrt mit Ziel + aktuellem Fortschritt.
 */

export type LeagueAchievementState = "reached" | "locked";
export type LeagueAchievementGroup = "leaderboard" | "squad" | "table" | "transfers" | "history";

export type LeagueAchievement = {
  id: string;
  group: LeagueAchievementGroup;
  label: string;
  description: string;
  state: LeagueAchievementState;
  /** Kontext bei erreichten Meilensteinen (Wert/Spieler/Team). */
  detail: string | null;
  /** Saison/Zeitpunkt, wenn ableitbar (v. a. archivierte Meilensteine). */
  contextLabel: string | null;
  /** Aktueller Stand für gesperrte Meilensteine ("82 / 90"). */
  progressLabel: string | null;
  /** Zielbeschreibung für gesperrte Meilensteine. */
  targetLabel: string | null;
  tone: NlTone;
  playerId: string | null;
};

export type LeagueAchievements = {
  hasTeam: boolean;
  hasData: boolean;
  teamName: string | null;
  reachedCount: number;
  totalCount: number;
  achievements: LeagueAchievement[];
};

const GROUP_LABELS: Record<LeagueAchievementGroup, string> = {
  leaderboard: "Ranglisten",
  squad: "Kader",
  table: "Tabelle",
  transfers: "Transfers",
  history: "Historie",
};

export function getLeagueAchievementGroupLabel(group: LeagueAchievementGroup): string {
  return GROUP_LABELS[group];
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function resolveOwnStandingRank(
  standings: Record<string, StandingRecord>,
  teamId: string,
): { rank: number | null; seasonStarted: boolean } {
  const rows = Object.entries(standings);
  const seasonStarted = rows.some(([, record]) => Number.isFinite(record.points) && (record.points ?? 0) > 0);
  const own = standings[teamId] ?? null;
  if (!own) {
    return { rank: null, seasonStarted };
  }
  if (own.rank != null && Number.isFinite(own.rank)) {
    return { rank: own.rank, seasonStarted };
  }
  if (!seasonStarted) {
    return { rank: null, seasonStarted };
  }
  // Ableitung nur wenn bereits Ergebnisse vorliegen (sonst wären alle 0 Punkte
  // gleichauf und "Rang 1" wäre irreführend).
  const ownPoints = own.points ?? 0;
  const strictlyAbove = rows.filter(([, record]) => (record.points ?? 0) > ownPoints).length;
  return { rank: strictlyAbove + 1, seasonStarted };
}

export function buildLeagueAchievements(input: {
  gameState: GameState | null;
  categories: LeagueLeaderCategory[];
  selectedTeamId: string | null;
}): LeagueAchievements {
  const { gameState, categories, selectedTeamId } = input;

  if (!gameState || selectedTeamId == null) {
    return {
      hasTeam: selectedTeamId != null,
      hasData: false,
      teamName: null,
      reachedCount: 0,
      totalCount: 0,
      achievements: [],
    };
  }

  const team = gameState.teams.find((candidate) => candidate.teamId === selectedTeamId) ?? null;
  const teamName = team?.name ?? null;
  const achievements: LeagueAchievement[] = [];

  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const ownRosterPlayers = gameState.rosters
    .filter((roster) => roster.teamId === selectedTeamId)
    .map((roster) => playerById.get(roster.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  // --- Ranglisten-Footprint (öffentlich) --------------------------------
  const footprint = buildOwnTeamLeaderboardFootprint({ categories, selectedTeamId });

  achievements.push({
    id: "leaderboard-top5",
    group: "leaderboard",
    label: "Top-5 der Liga",
    description: "Bringe einen Kader-Spieler in die ligaweite Top-5 einer Kategorie.",
    state: footprint.categoriesWithTop5 > 0 ? "reached" : "locked",
    detail:
      footprint.bestPlacement != null
        ? `#${footprint.bestPlacement.rank} ${footprint.bestPlacement.categoryLabel} · ${footprint.bestPlacement.playerName}`
        : null,
    contextLabel: null,
    progressLabel: `${footprint.categoriesWithTop5} Kategorie${footprint.categoriesWithTop5 === 1 ? "" : "n"}`,
    targetLabel: footprint.categoriesWithTop5 > 0 ? null : "Ziel: 1× Top-5",
    tone: "good",
    playerId: footprint.bestPlacement?.playerId ?? null,
  });

  achievements.push({
    id: "leaderboard-leader",
    group: "leaderboard",
    label: "Liga-Anführer gestellt",
    description: "Stelle in einer Kategorie den ligaweiten Spitzenreiter (Rang 1).",
    state: footprint.leaderCount > 0 ? "reached" : "locked",
    detail:
      footprint.bestPlacement != null && footprint.bestPlacement.rank === 1
        ? `${footprint.bestPlacement.categoryLabel} · ${footprint.bestPlacement.playerName}`
        : null,
    contextLabel: null,
    progressLabel:
      footprint.bestPlacement != null ? `Beste Platzierung: #${footprint.bestPlacement.rank}` : null,
    targetLabel: footprint.leaderCount > 0 ? null : "Ziel: Rang 1 in einer Kategorie",
    tone: "warn",
    playerId: footprint.bestPlacement?.playerId ?? null,
  });

  // --- Kader-OVR (öffentlich, eigenes Team) -----------------------------
  const bestOvrPlayer = ownRosterPlayers
    .filter((player) => Number.isFinite(player.ovr ?? Number.NaN))
    .reduce<{ ovr: number; name: string; id: string } | null>((best, player) => {
      const ovr = player.ovr as number;
      if (best == null || ovr > best.ovr) {
        return { ovr, name: player.name, id: player.id };
      }
      return best;
    }, null);

  for (const tier of [
    { id: "squad-ovr-85", target: 85, label: "Star-Spieler", tone: "accent" as NlTone },
    { id: "squad-ovr-90", target: 90, label: "Elite-Spieler", tone: "pow" as NlTone },
  ]) {
    const reached = bestOvrPlayer != null && bestOvrPlayer.ovr >= tier.target;
    achievements.push({
      id: tier.id,
      group: "squad",
      label: `${tier.label} (OVR ${tier.target}+)`,
      description: `Halte einen Kader-Spieler mit OVR ${tier.target} oder mehr.`,
      state: reached ? "reached" : "locked",
      detail: reached && bestOvrPlayer != null ? `${bestOvrPlayer.name} · OVR ${formatNlNumber(bestOvrPlayer.ovr, 0)}` : null,
      contextLabel: null,
      progressLabel:
        bestOvrPlayer != null
          ? `Bester Kader-OVR: ${formatNlNumber(bestOvrPlayer.ovr, 0)} / ${tier.target}`
          : "Kein Kader-OVR verfügbar",
      targetLabel: reached ? null : `Ziel: OVR ${tier.target}`,
      tone: tier.tone,
      playerId: reached && bestOvrPlayer != null ? bestOvrPlayer.id : null,
    });
  }

  // --- Kaderwert (öffentliche Display-Marktwerte, ligaweiter Vergleich) --
  const squadValues = buildTeamSquadMarketValues(gameState);
  const ownSquad = squadValues.find((row) => row.teamId === selectedTeamId) ?? null;
  const ownSquadRank = ownSquad != null ? squadValues.findIndex((row) => row.teamId === selectedTeamId) + 1 : null;
  const squadMedian = median(squadValues.map((row) => row.total));

  achievements.push({
    id: "squad-value-median",
    group: "squad",
    label: "Kaderwert über Liga-Median",
    description: "Bringe den Kader-Marktwert über den Median aller Teams.",
    state: ownSquad != null && squadMedian != null && ownSquad.total > squadMedian ? "reached" : "locked",
    detail:
      ownSquad != null && squadMedian != null && ownSquad.total > squadMedian
        ? `${formatNlNumber(ownSquad.total, 0)} (Median ${formatNlNumber(squadMedian, 0)})`
        : null,
    contextLabel: null,
    progressLabel:
      ownSquad != null && squadMedian != null
        ? `${formatNlNumber(ownSquad.total, 0)} / Median ${formatNlNumber(squadMedian, 0)}`
        : null,
    targetLabel:
      ownSquad != null && squadMedian != null && ownSquad.total > squadMedian
        ? null
        : "Ziel: Kaderwert über dem Liga-Median",
    tone: "accent",
    playerId: null,
  });

  achievements.push({
    id: "squad-value-top3",
    group: "squad",
    label: "Kaderwert unter den Top 3",
    description: "Erreiche mit dem Kader-Marktwert einen ligaweiten Top-3-Platz.",
    state: ownSquadRank != null && ownSquadRank <= 3 ? "reached" : "locked",
    detail: ownSquadRank != null && ownSquadRank <= 3 ? `#${ownSquadRank} · ${formatNlNumber(ownSquad?.total ?? 0, 0)}` : null,
    contextLabel: null,
    progressLabel: ownSquadRank != null ? `Aktuell: Kaderwert-Rang #${ownSquadRank}` : null,
    targetLabel: ownSquadRank != null && ownSquadRank <= 3 ? null : "Ziel: Kaderwert-Rang 3 oder besser",
    tone: "warn",
    playerId: null,
  });

  // --- Transfers (eigenes Team) -----------------------------------------
  const ownTransferCount = (gameState.transferHistory ?? []).filter(
    (transfer) =>
      transfer.transferType !== "contract_exit" &&
      (transfer.fromTeamId === selectedTeamId || transfer.toTeamId === selectedTeamId),
  ).length;

  for (const tier of [
    { id: "transfers-1", target: 1, label: "Erster Transfer" },
    { id: "transfers-5", target: 5, label: "Aktiver Manager" },
    { id: "transfers-15", target: 15, label: "Transfer-Stratege" },
  ]) {
    const reached = ownTransferCount >= tier.target;
    achievements.push({
      id: tier.id,
      group: "transfers",
      label: `${tier.label} (${tier.target} Transfer${tier.target === 1 ? "" : "s"})`,
      description: `Tätige insgesamt ${tier.target} Transfer${tier.target === 1 ? "" : "s"} (Kauf oder Verkauf).`,
      state: reached ? "reached" : "locked",
      detail: reached ? `${formatNlNumber(ownTransferCount, 0)} Transfers getätigt` : null,
      contextLabel: null,
      progressLabel: `${formatNlNumber(ownTransferCount, 0)} / ${tier.target}`,
      targetLabel: reached ? null : `Ziel: ${tier.target} Transfers`,
      tone: "men",
      playerId: null,
    });
  }

  // --- Tabelle (öffentlich, nur wenn Ergebnisse vorliegen) --------------
  const standings = gameState.seasonState.standings ?? {};
  const { rank: ownRank, seasonStarted } = resolveOwnStandingRank(standings, selectedTeamId);

  achievements.push({
    id: "table-top10",
    group: "table",
    label: "Top-10 in der Tabelle",
    description: "Stehe in der laufenden Saison auf einem Top-10-Tabellenplatz.",
    state: seasonStarted && ownRank != null && ownRank <= 10 ? "reached" : "locked",
    detail: seasonStarted && ownRank != null && ownRank <= 10 ? `Aktuell Rang #${ownRank}` : null,
    contextLabel: null,
    progressLabel: !seasonStarted
      ? "Noch keine Ergebnisse"
      : ownRank != null
        ? `Aktuell: Rang #${ownRank}`
        : null,
    targetLabel: seasonStarted && ownRank != null && ownRank <= 10 ? null : "Ziel: Tabellenrang 10 oder besser",
    tone: "good",
    playerId: null,
  });

  achievements.push({
    id: "table-leader",
    group: "table",
    label: "Tabellenführung",
    description: "Übernimm in der laufenden Saison die Tabellenspitze.",
    state: seasonStarted && ownRank === 1 ? "reached" : "locked",
    detail: seasonStarted && ownRank === 1 ? "Rang #1 der Liga" : null,
    contextLabel: null,
    progressLabel: !seasonStarted
      ? "Noch keine Ergebnisse"
      : ownRank != null
        ? `Aktuell: Rang #${ownRank}`
        : null,
    targetLabel: seasonStarted && ownRank === 1 ? null : "Ziel: Tabellenrang 1",
    tone: "warn",
    playerId: null,
  });

  // --- Historie (archivierte Endstände) ---------------------------------
  const snapshots = [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => (snapshot.finalStandings?.length ?? 0) > 0)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }));

  let seasonsCompleted = 0;
  let firstMedalSeason: string | null = null;
  let firstTitleSeason: string | null = null;
  for (const snapshot of snapshots) {
    const ownRecord = resolveSeasonSnapshotTeamRecords(snapshot).find((row) => row.teamId === selectedTeamId) ?? null;
    if (!ownRecord) {
      continue;
    }
    seasonsCompleted += 1;
    const label = getCanonicalSeasonLabel({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName });
    if (firstMedalSeason == null && (ownRecord.isGold || ownRecord.isSilver || ownRecord.isBronze)) {
      firstMedalSeason = label;
    }
    if (firstTitleSeason == null && ownRecord.isGold) {
      firstTitleSeason = label;
    }
  }

  achievements.push({
    id: "history-first-season",
    group: "history",
    label: "Erste Saison abgeschlossen",
    description: "Beende deine erste komplette Saison.",
    state: seasonsCompleted >= 1 ? "reached" : "locked",
    detail: seasonsCompleted >= 1 ? `${formatNlNumber(seasonsCompleted, 0)} Saison${seasonsCompleted === 1 ? "" : "en"} gespielt` : null,
    contextLabel: null,
    progressLabel: seasonsCompleted >= 1 ? null : "Läuft in der aktuellen Saison",
    targetLabel: seasonsCompleted >= 1 ? null : "Ziel: 1 Saison abschließen",
    tone: "men",
    playerId: null,
  });

  achievements.push({
    id: "history-first-medal",
    group: "history",
    label: "Erste Medaille",
    description: "Schließe eine Saison auf einem Medaillenrang ab (Gold/Silber/Bronze).",
    state: firstMedalSeason != null ? "reached" : "locked",
    detail: firstMedalSeason != null ? "Medaillenrang erreicht" : null,
    contextLabel: firstMedalSeason,
    progressLabel: firstMedalSeason != null ? null : "Noch keine Medaille",
    targetLabel: firstMedalSeason != null ? null : "Ziel: Top-3-Saisonabschluss",
    tone: "warn",
    playerId: null,
  });

  achievements.push({
    id: "history-first-title",
    group: "history",
    label: "Meistertitel",
    description: "Gewinne eine Saison (Goldrang).",
    state: firstTitleSeason != null ? "reached" : "locked",
    detail: firstTitleSeason != null ? "Meisterschaft gewonnen" : null,
    contextLabel: firstTitleSeason,
    progressLabel: firstTitleSeason != null ? null : "Noch kein Titel",
    targetLabel: firstTitleSeason != null ? null : "Ziel: Saison auf Rang 1 beenden",
    tone: "warn",
    playerId: null,
  });

  const reachedCount = achievements.filter((achievement) => achievement.state === "reached").length;

  // Erreichte zuerst (stabil), dann gesperrte — für eine befriedigende Leseordnung.
  const ordered = [
    ...achievements.filter((achievement) => achievement.state === "reached"),
    ...achievements.filter((achievement) => achievement.state === "locked"),
  ];

  return {
    hasTeam: true,
    hasData: true,
    teamName,
    reachedCount,
    totalCount: achievements.length,
    achievements: ordered,
  };
}
