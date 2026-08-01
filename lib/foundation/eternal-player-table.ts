/**
 * EWIGE TABELLE — wer hat je für dieses Team gepunktet, und wer ist der Beste der Liga.
 *
 * GEWÜNSCHT: „es wäre cool dass hier quasi so ne ewige tabelle ALLER spieler aus dem team wären.
 * also alle spieler die das team je hatte mit allen PPs usw. Aber dass man auch wechseln kann auf
 * ALLE spieler und sehen kann wer ist all time best etc."
 *
 * Zwei Fragen, eine Tabelle:
 *
 *   Team-Sicht   „Wer hat je für UNS gespielt — und was hat er uns gebracht?"
 *   Liga-Sicht   „Wer ist der Beste, den diese Liga je gesehen hat?"
 *
 * DAS KERNPROBLEM ist die Zuordnung der Punkte bei einem Verkauf: ein Spieler, der 38 PPs für
 * Team A holte und dann zu Team B ging, darf nicht mit seiner GESAMTsumme in der Team-A-Tabelle
 * stehen. `seasonPointsLedger.playerSummariesByPlayerId[].pointsByTeamId` löst genau das — die
 * Punkte liegen dort bereits nach Team getrennt, weil jeder Auftritt eine `teamId` trägt. Es
 * gibt hier also nichts nachzurechnen; die Ewige Tabelle ist eine PROJEKTION vorhandener Daten.
 *
 * „War je im Team" ist in Saison 1 vollständig ableitbar: aktueller Kader ∪ `transferHistory`
 * (`fromTeamId`/`toTeamId`). Ein Spieler, der verkauft wurde, bevor er je punktete, erscheint
 * korrekt mit 0 PPs — sein Verkaufseintrag trägt `fromTeamId`.
 *
 * ARCHIV: Für abgeschlossene Saisons rechnet derselbe Weg über
 * `snapshot.playerDisciplinePerformances` — die trägt `teamId` je Auftritt, ist also genauso fein
 * wie der Live-Ledger. `snapshot.playerPerformances` wäre gröber (eine `teamId` je Saison) und
 * würde einen Mid-Season-Wechsel dem falschen Team zuschlagen.
 */
import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

export type EternalPlayerScope = { kind: "league" } | { kind: "team"; teamId: string };

export type EternalPlayerStatus = "im_kader" | "verkauft" | "weg";

export type EternalPlayerRow = {
  playerId: string;
  playerName: string;
  /** In der Team-Sicht: das betrachtete Team. In der Liga-Sicht: das aktuelle Team (oder null). */
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  /** Alle Teams, für die der Spieler je gepunktet hat — nur Liga-Sicht befüllt. */
  teams: string[];
  /** Einsätze, die zum Scope zählen (Team-Sicht: nur für dieses Team). */
  appearances: number;
  /** PPs, die zum Scope zählen (Team-Sicht: nur die für dieses Team erspielten). */
  points: number;
  /** PPs über die ganze Karriere — in der Team-Sicht der Vergleichswert daneben. */
  careerPoints: number;
  /** Wie viele Saisons der Spieler im Scope Auftritte hatte. */
  seasons: number;
  /** Zeitraum in Saison-Nummern, z. B. „S1" oder „S1–S3". */
  zeitraum: string;
  /** Nur Team-Sicht: steht er noch im Kader, wurde er verkauft, ist er weg? */
  status: EternalPlayerStatus;
  /** Nur Team-Sicht und nur bei `verkauft`: an wen. */
  verkauftAn: string | null;
};

export type EternalPlayerTable = {
  scope: EternalPlayerScope;
  /** Wie viele Saisons in die Tabelle eingehen (Archiv + laufende). */
  seasonCount: number;
  /** Nur die laufende Saison ist bekannt — für das ehrliche Etikett „bisher 1 Saison". */
  onlyCurrentSeason: boolean;
  rows: EternalPlayerRow[];
};

type SaisonBeitrag = {
  seasonId: string;
  appearances: number;
  points: number;
};

/** Auftritte je Spieler × Team × Saison — die feinste Körnung, die beide Datenlagen hergeben. */
type Beitraege = Map<string, Map<string, SaisonBeitrag[]>>;

function runde(value: number, stellen = 1) {
  return Number(value.toFixed(stellen));
}

function merke(beitraege: Beitraege, playerId: string, teamId: string, seasonId: string, appearances: number, points: number) {
  if (!playerId || !teamId) return;
  if (appearances <= 0 && points <= 0) return;
  const proTeam = beitraege.get(playerId) ?? new Map<string, SaisonBeitrag[]>();
  const saisons = proTeam.get(teamId) ?? [];
  const vorhanden = saisons.find((eintrag) => eintrag.seasonId === seasonId);
  if (vorhanden) {
    vorhanden.appearances += appearances;
    vorhanden.points = runde(vorhanden.points + points, 1);
  } else {
    saisons.push({ seasonId, appearances, points: runde(points, 1) });
  }
  proTeam.set(teamId, saisons);
  beitraege.set(playerId, proTeam);
}

/**
 * `null` statt `0`, wenn keine Nummer im Saison-Schlüssel steht.
 *
 * Mit `0` als Ersatzwert liesse sich „nicht lesbar" nicht von „Saison 0" unterscheiden — die
 * echte Saison fiele beim Filtern mit heraus und der Zeitraum begänne stillschweigend zu spät.
 */
function saisonNummer(seasonId: string): number | null {
  const treffer = seasonId.match(/(\d+)$/);
  return treffer ? Number(treffer[1]) : null;
}

function zeitraumText(seasonIds: string[]): string {
  const nummern = [...new Set(seasonIds.map(saisonNummer))]
    .filter((nummer): nummer is number => nummer != null)
    .sort((a, b) => a - b);
  if (nummern.length === 0) return "—";
  if (nummern.length === 1) return `S${nummern[0]}`;
  return `S${nummern[0]}–S${nummern[nummern.length - 1]}`;
}

/**
 * Beiträge aus einem archivierten Snapshot.
 *
 * Bewusst über `playerDisciplinePerformances` und nicht über `playerPerformances`: Erstere trägt
 * die `teamId` je AUFTRITT, Letztere nur eine je Saison. Bei einem Wechsel innerhalb einer
 * Saison schlüge die gröbere Variante alle Punkte dem Team zu, bei dem der Spieler zufällig
 * am Saisonende stand.
 */
function sammleAusSnapshot(snapshot: SeasonSnapshotRecord, beitraege: Beitraege) {
  const auftritte = snapshot.playerDisciplinePerformances ?? [];
  if (auftritte.length > 0) {
    for (const auftritt of auftritte) {
      const punkte = typeof auftritt.scoreContribution === "number" ? auftritt.scoreContribution : 0;
      merke(beitraege, auftritt.playerId, auftritt.teamId, snapshot.seasonId, 1, punkte);
    }
    return;
  }

  // Fallback für ältere Snapshots ohne Auftrittsliste: gröber, aber besser als den Spieler
  // ganz zu verlieren.
  for (const performance of snapshot.playerPerformances ?? []) {
    const teamId = (performance as { teamId?: string | null }).teamId ?? null;
    if (!teamId) continue;
    merke(
      beitraege,
      performance.playerId,
      teamId,
      snapshot.seasonId,
      performance.appearances ?? 0,
      performance.totalPoints ?? 0,
    );
  }
}

export function buildEternalPlayerTable(
  gameState: GameState,
  scope: EternalPlayerScope,
  ledgerInput?: SeasonPointsLedger,
): EternalPlayerTable {
  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  const archivierteSaisons = new Set(snapshots.map((snapshot) => snapshot.seasonId));
  const beitraege: Beitraege = new Map();

  for (const snapshot of snapshots) {
    sammleAusSnapshot(snapshot, beitraege);
  }

  // Die laufende Saison nur, solange sie NICHT archiviert ist — sonst stünde sie doppelt.
  // Dieselbe Regel wie in `buildPlayerLeagueCareerStatsMap`.
  if (!archivierteSaisons.has(gameState.season.id)) {
    const ledger = ledgerInput ?? buildSeasonPointsLedger(gameState);
    const einsaetzeJeTeam = new Map<string, number>();
    for (const entry of ledger.pointEntries) {
      const schluessel = `${entry.playerId}::${entry.teamId}`;
      einsaetzeJeTeam.set(schluessel, (einsaetzeJeTeam.get(schluessel) ?? 0) + 1);
    }
    for (const [playerId, summary] of ledger.playerSummariesByPlayerId.entries()) {
      for (const [teamId, punkte] of Object.entries(summary.pointsByTeamId)) {
        merke(
          beitraege,
          playerId,
          teamId,
          gameState.season.id,
          einsaetzeJeTeam.get(`${playerId}::${teamId}`) ?? 0,
          punkte,
        );
      }
    }
  }

  const spielerNamen = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));
  const teams = new Map((gameState.teams ?? []).map((team) => [team.teamId, team] as const));
  const aktuellesTeamVon = new Map((gameState.rosters ?? []).map((entry) => [entry.playerId, entry.teamId] as const));

  const seasonCount = archivierteSaisons.size + (archivierteSaisons.has(gameState.season.id) ? 0 : 1);
  const onlyCurrentSeason = archivierteSaisons.size === 0;

  const karrierePunkte = (playerId: string) => {
    const proTeam = beitraege.get(playerId);
    if (!proTeam) return 0;
    let summe = 0;
    for (const saisons of proTeam.values()) {
      for (const saison of saisons) summe += saison.points;
    }
    return runde(summe, 1);
  };

  if (scope.kind === "team") {
    /**
     * „War je im Team": aktueller Kader ∪ jeder Transfer, der das Team berührt.
     *
     * Beide Richtungen zählen — wer verkauft wurde, war vorher da (`fromTeamId`), und wer gekauft
     * wurde, ist es seitdem (`toTeamId`). Ohne die Transferhistorie fehlten genau die Spieler,
     * um die es dem Spieler geht: die abgegebenen.
     */
    const jeImTeam = new Set<string>();
    for (const eintrag of gameState.rosters ?? []) {
      if (eintrag.teamId === scope.teamId) jeImTeam.add(eintrag.playerId);
    }
    const letzterAbgang = new Map<string, string | null>();
    for (const transfer of gameState.transferHistory ?? []) {
      if (transfer.fromTeamId === scope.teamId) {
        jeImTeam.add(transfer.playerId);
        letzterAbgang.set(transfer.playerId, transfer.toTeamId ?? null);
      }
      if (transfer.toTeamId === scope.teamId) {
        jeImTeam.add(transfer.playerId);
      }
    }
    // Wer für das Team gepunktet hat, war offensichtlich auch im Team — selbst wenn Kader und
    // Transferhistorie ihn nicht mehr kennen (z. B. reine Archivspieler).
    for (const [playerId, proTeam] of beitraege.entries()) {
      if (proTeam.has(scope.teamId)) jeImTeam.add(playerId);
    }

    const rows: EternalPlayerRow[] = [...jeImTeam].map((playerId) => {
      const saisons = beitraege.get(playerId)?.get(scope.teamId) ?? [];
      const appearances = saisons.reduce((summe, saison) => summe + saison.appearances, 0);
      const points = runde(
        saisons.reduce((summe, saison) => summe + saison.points, 0),
        1,
      );
      const imKader = aktuellesTeamVon.get(playerId) === scope.teamId;
      const abgangZu = letzterAbgang.get(playerId);
      const status: EternalPlayerStatus = imKader ? "im_kader" : abgangZu != null ? "verkauft" : "weg";
      const team = teams.get(scope.teamId) ?? null;
      return {
        playerId,
        playerName: spielerNamen.get(playerId) ?? playerId,
        teamId: scope.teamId,
        teamCode: team?.shortCode ?? null,
        teamName: team?.name ?? null,
        teams: [],
        appearances,
        points,
        careerPoints: karrierePunkte(playerId),
        seasons: saisons.length,
        zeitraum: zeitraumText(saisons.map((saison) => saison.seasonId)),
        status,
        verkauftAn: abgangZu != null ? teams.get(abgangZu)?.name ?? null : null,
      } satisfies EternalPlayerRow;
    });

    return { scope, seasonCount, onlyCurrentSeason, rows: sortiere(rows) };
  }

  // --- Liga-Sicht: alle Spieler mit Karrieredaten ------------------------
  const rows: EternalPlayerRow[] = [...beitraege.entries()].map(([playerId, proTeam]) => {
    let appearances = 0;
    let points = 0;
    const seasonIds = new Set<string>();
    const teamNamen: string[] = [];
    for (const [teamId, saisons] of proTeam.entries()) {
      const teamName = teams.get(teamId)?.name ?? null;
      if (teamName && !teamNamen.includes(teamName)) teamNamen.push(teamName);
      for (const saison of saisons) {
        appearances += saison.appearances;
        points += saison.points;
        seasonIds.add(saison.seasonId);
      }
    }
    const aktuellesTeam = aktuellesTeamVon.get(playerId) ?? null;
    const team = aktuellesTeam ? teams.get(aktuellesTeam) ?? null : null;
    return {
      playerId,
      playerName: spielerNamen.get(playerId) ?? playerId,
      teamId: aktuellesTeam,
      teamCode: team?.shortCode ?? null,
      teamName: team?.name ?? null,
      teams: teamNamen,
      appearances,
      points: runde(points, 1),
      careerPoints: runde(points, 1),
      seasons: seasonIds.size,
      zeitraum: zeitraumText([...seasonIds]),
      status: aktuellesTeam ? "im_kader" : "weg",
      verkauftAn: null,
    } satisfies EternalPlayerRow;
  });

  return { scope, seasonCount, onlyCurrentSeason, rows: sortiere(rows) };
}

/** Nach Punkten, dann Einsätzen, dann Name — damit die Reihenfolge ohne Spielgeschehen stabil ist. */
function sortiere(rows: EternalPlayerRow[]): EternalPlayerRow[] {
  return [...rows].sort((links, rechts) => {
    if (rechts.points !== links.points) return rechts.points - links.points;
    if (rechts.appearances !== links.appearances) return rechts.appearances - links.appearances;
    return links.playerName.localeCompare(rechts.playerName, "de");
  });
}
