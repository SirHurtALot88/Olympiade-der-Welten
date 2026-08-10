/**
 * GEMELDET: „S1 steht hier noch nicht welchen rank sie hatten, und da könnte man gut noch die
 * punkte ergänzen" — zur Saison-Verlauf-Karte im Teamprofil, die fuer Saison 1 nur „—" zeigte.
 *
 * BEFUND: es fehlten keine Daten. Der Saison-1-Schnappschuss im Spielstand ist vollstaendig, alle
 * 32 Teams mit Rang und Punkten (am Live-Spielstand nachgesehen: S-C Rang 19, 86.3 Punkte). Nur
 * kommt er nie im Browser an — `compactFoundationInitialGameState` streicht `seasonSnapshots` aus
 * der Anfangsladung. Ohne Schnappschuesse baut die Historie fuer jede vergangene Saison eine
 * Platzhalterzeile mit `rank: null`, und genau die zeigt die Karte als „—".
 *
 * DAS STREICHEN BLEIBT RICHTIG. Ein Schnappschuss schleppt Spielerleistungen, Spieltags- und
 * Disziplinergebnisse mit; das sind pro Saison Megabytes, die keine Ansicht am Stueck braucht.
 * Deshalb faehrt statt der vollen Schnappschuesse diese Projektion mit: pro Saison und Team die
 * gut zehn Zahlen, aus denen die Historienzeile besteht.
 *
 * WARUM EIN EIGENES FELD UND NICHT `seasonSnapshots` SELBST:
 *
 * Der Schutz des Archivs (`preserveAppendOnlyArchive`) vergleicht nur die ANZAHL der Eintraege —
 * eingehend gewinnt, sobald es mindestens so viele sind wie gespeichert. Eine schlanke Fassung
 * unter demselben Namen haette exakt dieselbe Anzahl, kaeme also durch und wuerde beim naechsten
 * Speichern die vollen Schnappschuesse dauerhaft durch die Kurzfassung ersetzen. Der Verlust
 * waere endgueltig und stillschweigend. Die Projektion liegt darum in einem eigenen Feld, das
 * nirgends zurueckgeschrieben wird: sie ist reine Anzeigefracht, keine Quelle.
 */
import type {
  GameState,
  SeasonSnapshotPlayerPerformanceRecord,
  SeasonSnapshotRecord,
} from "@/lib/data/olyDataTypes";

import { getSnapshotPlayerPerformances } from "@/lib/foundation/snapshot-player-performance";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";

/**
 * Eine Team-Zeile einer abgeschlossenen Saison.
 *
 * ROHWERTE, NICHT VORAB AUSGEWAEHLT. Die Felder heissen wie im Schnappschuss und tragen dessen
 * Werte unveraendert. Der Grund ist, dass die Ansichten sich bei Cash und Marktwert bewusst
 * UNTERSCHEIDEN: die Historienzeile zeigt den Saisonabschluss, die Ewige Tabelle den
 * Eintrittsstand der Folgesaison (Chris' Vorgabe: „die snapshots für Cash und Marktwert sollen ja
 * auch erst am anfang der Saison nach den Käufen stattfinden"). Am Live-Spielstand liegen die zwei
 * Regeln bei 30 von 32 Teams auseinander — S-C etwa 56.8 gegen 91.32. Eine hier schon
 * zusammengefasste Zahl koennte also immer nur eine der beiden Ansichten richtig bedienen.
 */
export type FoundationSeasonHistoryTeamEntry = {
  teamId: string;
  teamCode: string | null;
  teamName: string | null;
  rank: number | null;
  points: number | null;
  disciplinePoints: number | null;
  disciplinePointsByArea: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  cashEnd: number | null;
  cashTotal: number | null;
  cashEntry: number | null;
  salaryEnd: number | null;
  salaryTotalEnd: number | null;
  marketValueEnd: number | null;
  marketValueSeasonEnd: number | null;
  cashSeasonEnd: number | null;
  salarySeasonEnd: number | null;
  rosterSeasonEnd: number | null;
  marketValueTotalEnd: number | null;
  guv: number | null;
};

/**
 * Eine Spielerzeile einer abgeschlossenen Saison — die Fracht, aus der der Spieler-Drawer seine
 * „Sportliche Historie" und die Verlaufs-Deltas der OVR/PPS/MVS-Kacheln baut.
 *
 * GEMELDET: „bitte prüfe dass die S1 snapshots mit den punkten usw in den historien verfügbar ist"
 * und „in den kacheln steht kein verlauf obwohl jasper in season 1 auch dabei war".
 *
 * BEFUND: auch hier fehlten keine Daten — der Saison-1-Schnappschuss traegt 333 vollstaendige
 * Leistungszeilen. Am Live-Spielstand nachgemessen (Vega, S-C): auf dem vollen Save zeigt die
 * Historie pps 10,7 / ovr 70,8 / mvs 13, nach `compactFoundationInitialGameState` steht in jeder
 * Spalte „—". Die Team-Projektion oben half nicht, weil sie `playerPerformances` ausdruecklich leer
 * liess. Ohne Vorsaison-Zeile ist auch jedes Delta null, und die Kachel schreibt „Kein Verlauf".
 *
 * OHNE `disciplineBreakdown`, BEWUSST: der Aufschluesselung je Disziplin verdankt die volle Zeile
 * den Grossteil ihrer Groesse (gemessen 647 KiB gegen 88 KiB fuer diese Fassung, je Saison). Die
 * Achsen kommen ueber `powPoints`…`socPoints` mit, und genau die zeigt die Historie. Wer die
 * Aufschluesselung braucht, muss den vollen Schnappschuss lesen — also serverseitig.
 */
export type FoundationSeasonHistoryPlayerEntry = {
  playerId: string;
  playerName: string | null;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  appearances: number | null;
  totalContribution: number | null;
  totalPoints: number | null;
  averageContribution: number | null;
  averageFinalScore: number | null;
  powPoints: number | null;
  spePoints: number | null;
  menPoints: number | null;
  socPoints: number | null;
  ovr: number | null;
  ovrRank: number | null;
  pps: number | null;
  ppsRank: number | null;
  mvs: number | null;
  mvsRank: number | null;
  marketValue: number | null;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number | null;
  bestDisciplineLabel: string | null;
};

export type FoundationSeasonHistoryEntry = {
  seasonId: string;
  seasonName: string | null;
  status: string | null;
  /**
   * Steuert die Marktwert-Auswahl der Ewigen Tabelle (gepatchter Eintrittsstand vs. Saisonende) —
   * ohne dieses Feld muesste sie raten, welcher der drei Marktwerte gemeint ist.
   */
  entryRosterPatchedAt: string | null;
  teams: FoundationSeasonHistoryTeamEntry[];
  /** Siehe FoundationSeasonHistoryPlayerEntry — ohne sie bleibt die Spielerhistorie im Browser leer. */
  players: FoundationSeasonHistoryPlayerEntry[];
  /** Nur Top-Zu- und -Abgang je Team; die Historienzeile zeigt nicht mehr. */
  transfers: Array<{
    type: string;
    playerId: string | null;
    playerName: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
    amount: number | null;
  }>;
};

function zahlOderNull(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

function textOderNull(wert: unknown): string | null {
  return typeof wert === "string" && wert.length > 0 ? wert : null;
}

function projiziereTeam(record: {
  teamId: string;
  teamCode?: string | null;
  teamName?: string | null;
  rank?: number | null;
  points?: number | null;
  disciplinePoints?: number | null;
  disciplinePointsByArea?: { pow?: number | null; spe?: number | null; men?: number | null; soc?: number | null };
  cashEnd?: number | null;
  cashTotal?: number | null;
  cashEntry?: number | null;
  salaryTotalEnd?: number | null;
  salaryEnd?: number | null;
  marketValueSeasonEnd?: number | null;
  cashSeasonEnd?: number | null;
  salarySeasonEnd?: number | null;
  rosterSeasonEnd?: number | null;
  marketValueTotalEnd?: number | null;
  marketValueEnd?: number | null;
  guv?: number | null;
}): FoundationSeasonHistoryTeamEntry {
  const bereich = record.disciplinePointsByArea ?? {};
  return {
    teamId: record.teamId,
    teamCode: textOderNull(record.teamCode),
    teamName: textOderNull(record.teamName),
    rank: zahlOderNull(record.rank),
    points: zahlOderNull(record.points),
    disciplinePoints: zahlOderNull(record.disciplinePoints),
    disciplinePointsByArea: {
      pow: zahlOderNull(bereich.pow),
      spe: zahlOderNull(bereich.spe),
      men: zahlOderNull(bereich.men),
      soc: zahlOderNull(bereich.soc),
    },
    cashEnd: zahlOderNull(record.cashEnd),
    cashTotal: zahlOderNull(record.cashTotal),
    cashEntry: zahlOderNull(record.cashEntry),
    salaryEnd: zahlOderNull(record.salaryEnd),
    salaryTotalEnd: zahlOderNull(record.salaryTotalEnd),
    marketValueEnd: zahlOderNull(record.marketValueEnd),
    marketValueSeasonEnd: zahlOderNull(record.marketValueSeasonEnd),
    // Gemeinsam mit dem MW eingefroren — ohne diese drei Zeilen kaeme der
    // Saisonstand nie im Browser an und die Historie fiele weiter auf die
    // spaeter ueberschriebenen Felder zurueck.
    cashSeasonEnd: zahlOderNull(record.cashSeasonEnd),
    salarySeasonEnd: zahlOderNull(record.salarySeasonEnd),
    rosterSeasonEnd: zahlOderNull(record.rosterSeasonEnd),
    marketValueTotalEnd: zahlOderNull(record.marketValueTotalEnd),
    guv: zahlOderNull(record.guv),
  };
}

function projiziereSpieler(record: SeasonSnapshotPlayerPerformanceRecord): FoundationSeasonHistoryPlayerEntry {
  const alsUnbekannt = record as unknown as Record<string, unknown>;
  return {
    playerId: record.playerId,
    playerName: textOderNull(record.playerName),
    teamId: textOderNull(record.teamId),
    teamCode: textOderNull(record.teamCode),
    teamName: textOderNull(record.teamName),
    appearances: zahlOderNull(record.appearances),
    totalContribution: zahlOderNull(record.totalContribution),
    totalPoints: zahlOderNull(record.totalPoints),
    averageContribution: zahlOderNull(record.averageContribution),
    averageFinalScore: zahlOderNull(record.averageFinalScore),
    powPoints: zahlOderNull(record.powPoints),
    spePoints: zahlOderNull(record.spePoints),
    menPoints: zahlOderNull(record.menPoints),
    socPoints: zahlOderNull(record.socPoints),
    ovr: zahlOderNull(alsUnbekannt.ovr),
    ovrRank: zahlOderNull(alsUnbekannt.ovrRank),
    pps: zahlOderNull(alsUnbekannt.pps),
    ppsRank: zahlOderNull(alsUnbekannt.ppsRank),
    mvs: zahlOderNull(alsUnbekannt.mvs),
    mvsRank: zahlOderNull(alsUnbekannt.mvsRank),
    marketValue: zahlOderNull(alsUnbekannt.marketValue),
    purchasePrice: zahlOderNull(alsUnbekannt.purchasePrice),
    salary: zahlOderNull(alsUnbekannt.salary),
    contractLength: zahlOderNull(alsUnbekannt.contractLength),
    bestDisciplineLabel: textOderNull(record.bestDisciplineLabel),
  };
}

export function projiziereSaisonHistorie(
  snapshots: readonly SeasonSnapshotRecord[] | undefined,
): FoundationSeasonHistoryEntry[] {
  return (snapshots ?? []).map((snapshot) => ({
    seasonId: snapshot.seasonId,
    seasonName: snapshot.seasonName ?? null,
    status: snapshot.status ?? null,
    entryRosterPatchedAt: snapshot.entryRosterPatchedAt ?? null,
    teams: resolveSeasonSnapshotTeamRecords(snapshot).map((record) => projiziereTeam(record as never)),
    players: getSnapshotPlayerPerformances(snapshot).map(projiziereSpieler),
    transfers: (snapshot.transferSnapshots ?? []).map((entry) => ({
      type: String(entry.type),
      playerId: entry.playerId ?? null,
      playerName: entry.playerName ?? null,
      fromTeamId: entry.fromTeamId ?? null,
      toTeamId: entry.toTeamId ?? null,
      amount: zahlOderNull(entry.amount),
    })),
  }));
}

/**
 * Die Projektion einer bereits geladenen Ansicht — nimmt die vollen Schnappschuesse, wenn sie da
 * sind (Server), sonst die mitgefahrene Kurzfassung (Browser). Damit muss keine Ansicht wissen,
 * auf welcher Seite sie laeuft.
 */
export function leseSaisonHistorie(gameState: GameState): FoundationSeasonHistoryEntry[] {
  const voll = gameState.seasonState.seasonSnapshots;
  if (voll != null && voll.length > 0) {
    return projiziereSaisonHistorie(voll);
  }
  return gameState.seasonState.foundationSeasonHistory ?? [];
}

/**
 * GEMELDET: „1 Season ist rum aber kein team hat seine medallien bekommen" — die Ewige Tabelle
 * zeigte nach der abgeschlossenen Saison 1 bei jedem Team 🥇/🥈/🥉 auf null.
 *
 * BEFUND: auch hier fehlten keine Daten. Der Saison-1-Schnappschuss traegt 32 saubere Raenge, genau
 * einen je Platz (Gold Z-H, Silber M-M, Bronze L-R). Nur liest `buildAllTimeTableModel` die Medaillen
 * aus `gameState.seasonState.seasonSnapshots` — und die streicht die Anfangsladung. Ohne Archiv
 * zaehlt `buildAllTimeTableFromSnapshots` ueber eine leere Liste, und leer heisst null Medaillen.
 *
 * Diese Funktion ist die Rueckrichtung der Projektion: sie baut aus der mitgefahrenen Kurzfassung
 * wieder schnappschussfoermige Saetze, damit die bestehende Auszaehlung unveraendert darauf laufen
 * kann. Bewusst KEINE zweite Medaillen-Implementierung — Gold bleibt „Rang 1 in einer archivierten
 * Saison", gezaehlt an genau einer Stelle.
 *
 * WAS DIESE SAETZE NICHT SIND: ein Ersatz fuer das Archiv. Die schweren Anhaenge (Spieltags- und
 * Disziplinergebnisse) fehlen und bleiben leer. Sie taugen fuer die Ewige Tabelle, nicht als
 * Quelle — und sie werden nirgends zurueckgeschrieben.
 *
 * NACHTRAG: `playerPerformances` stand hier bis 2026-08-10 fest auf `[]`, und genau daran blieb die
 * Spielerhistorie haengen — die Sportliche Historie zeigte fuer jede abgeschlossene Saison „—" und
 * die OVR/PPS/MVS-Kacheln „Kein Verlauf", obwohl der Schnappschuss vollstaendig war. Die Zeilen
 * kommen jetzt aus der Projektion; sie tragen alles ausser `disciplineBreakdown` (Begruendung am
 * Typ oben). Der Vorbehalt bleibt: keine Quelle, nur Anzeige.
 */
export function alsSchnappschussErsatz(
  historie: readonly FoundationSeasonHistoryEntry[] | undefined,
  teams: readonly { teamId: string; shortCode: string; name: string }[] = [],
): SeasonSnapshotRecord[] {
  const nachTeamId = new Map(teams.map((team) => [team.teamId, team] as const));

  return (historie ?? []).map((eintrag) => ({
    snapshotId: `projektion-${eintrag.seasonId}`,
    seasonId: eintrag.seasonId,
    seasonName: eintrag.seasonName ?? eintrag.seasonId,
    archivedAt: "",
    status: (eintrag.status as SeasonSnapshotRecord["status"]) ?? undefined,
    entryRosterPatchedAt: eintrag.entryRosterPatchedAt,
    finalStandings: eintrag.teams.map((team) => {
      const liga = nachTeamId.get(team.teamId) ?? null;
      return {
        teamId: team.teamId,
        // Die Kurzfassung traegt Kuerzel und Namen selbst, damit ein inzwischen aus der Liga
        // genommenes Team in der Ewigen Tabelle nicht als nackte ID steht.
        teamCode: team.teamCode ?? liga?.shortCode ?? team.teamId,
        teamName: team.teamName ?? liga?.name ?? team.teamId,
        rank: team.rank,
        points: team.points,
        disciplinePoints: team.disciplinePoints,
        disciplinePointsByArea: team.disciplinePointsByArea,
        cashEnd: team.cashEnd,
        cashTotal: team.cashTotal,
        cashEntry: team.cashEntry,
        salaryEnd: team.salaryEnd,
        salaryTotalEnd: team.salaryTotalEnd,
        marketValueEnd: team.marketValueEnd,
        marketValueSeasonEnd: team.marketValueSeasonEnd,
        cashSeasonEnd: team.cashSeasonEnd,
        salarySeasonEnd: team.salarySeasonEnd,
        rosterSeasonEnd: team.rosterSeasonEnd,
        marketValueTotalEnd: team.marketValueTotalEnd,
        guv: team.guv,
      } as unknown as SeasonSnapshotRecord["finalStandings"][number];
    }),
    playerPerformances: (eintrag.players ?? []).map(
      (spieler) =>
        ({
          ...spieler,
          seasonId: eintrag.seasonId,
          // Die Aufschluesselung je Disziplin faehrt bewusst nicht mit. Leer statt fehlend, damit
          // `resolveSnapshotPlayerPerformanceRow` die Zeile ueber ihre Achsenpunkte als vollwertig
          // erkennt und nicht in die Neuherleitung faellt (die hier mangels Rohdaten scheitern wuerde).
          disciplineBreakdown: [],
          warnings: [],
        }) as unknown as NonNullable<SeasonSnapshotRecord["playerPerformances"]>[number],
    ),
  }));
}

/**
 * Die Saison-Schnappschuesse einer bereits geladenen Ansicht: die vollen, wenn sie da sind
 * (Server), sonst die aus der Kurzfassung wiederaufgebauten (Browser).
 *
 * Geschwister von `leseSaisonHistorie`, nur eine Ebene tiefer — Letztere liefert die
 * Historien-Eintraege, diese die schnappschussfoermigen Saetze, auf denen die bestehenden
 * Spieler-Auswertungen unveraendert laufen. Damit muss keine Ansicht wissen, auf welcher Seite
 * sie ausgefuehrt wird.
 */
export function leseSaisonSchnappschuesse(gameState: GameState): SeasonSnapshotRecord[] {
  const voll = gameState.seasonState.seasonSnapshots;
  if (voll != null && voll.length > 0) {
    return [...voll];
  }
  return alsSchnappschussErsatz(gameState.seasonState.foundationSeasonHistory, gameState.teams);
}
