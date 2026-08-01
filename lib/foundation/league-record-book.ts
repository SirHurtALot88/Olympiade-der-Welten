/**
 * DAS REKORDBUCH — Superlative, die ab dem ersten Spieltag entstehen.
 *
 * GEMELDET: „der rekorde tab ist noch tot da passiert fast gar nichts, keine interessanten
 * infos."
 *
 * Der Reiter hing komplett an `seasonSnapshots` — und die sind in Saison 1 leer. Der Befund war
 * also nicht „kaputt", sondern „wartet auf ein Archiv, das erst in zehn Spieltagen entsteht".
 *
 * Hier entsteht das Rekordbuch stattdessen aus dem, was jeder Spieltag ohnehin schreibt:
 * `disciplineResults` (Team-Ergebnis je Disziplin) und `playerDisciplinePerformances` (jeder
 * einzelne Auftritt). In Saison 1 stammt jeder Halter zwangsläufig aus Saison 1 — das ist kein
 * Leerzustand, sondern die Geburt des Rekordbuchs. Spätere Saisons müssen die Marken brechen.
 *
 * ÜBERGANG INS ARCHIV: `season-snapshot-service` archiviert genau diese beiden Listen 1:1. Jeder
 * Rekord hier ist später aus denselben Feldern im Snapshot reproduzierbar — ein Resolver, zwei
 * Datenlagen, kein Persistenz-Umbau. Deshalb wird hier auch nichts gespeichert.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

export type RecordBookEntry = {
  id: string;
  /** Kurzer Titel in Alltagssprache. */
  label: string;
  /** Ein Satz: was genau gemessen wird. */
  beschreibung: string;
  /** Fertig formatierter Wert. */
  displayValue: string;
  /** Wer den Rekord hält — Spieler oder Team. */
  halter: string;
  /** Kontext: Disziplin, Spieltag, Team. */
  kontext: string | null;
  /** Für den Sprung ins Profil, wenn der Halter ein Spieler ist. */
  playerId: string | null;
  teamId: string | null;
  /** Läuft die Serie noch? Nur bei Serien-Rekorden gesetzt. */
  laeuftNoch: boolean;
};

export type LeagueRecordBook = {
  /** Rekorde aus einzelnen Auftritten und Team-Ergebnissen. */
  spieltagsSuperlative: RecordBookEntry[];
  /** Rekorde über mehrere Spieltage hinweg. */
  serien: RecordBookEntry[];
  /** Wie viele Spieltage bereits Grundlage sind. */
  matchdaysPlayed: number;
};

function runde(value: number, stellen = 1) {
  return Number(value.toFixed(stellen));
}

function formatZahl(value: number, stellen = 1) {
  return runde(value, stellen).toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

function spieltagNummer(matchdayId: string): number {
  const treffer = matchdayId.match(/(\d+)$/);
  return treffer ? Number(treffer[1]) : 0;
}

/** Längste Folge aufeinanderfolgender Spieltage — und ob sie bis zum letzten reicht. */
function serieAus(nummern: number[], letzterSpieltag: number): { laenge: number; von: number; bis: number } | null {
  const sortiert = [...new Set(nummern)].sort((links, rechts) => links - rechts);
  if (sortiert.length === 0) return null;
  let beste = { laenge: 1, von: sortiert[0], bis: sortiert[0] };
  let start = sortiert[0];
  let laenge = 1;
  for (let index = 1; index < sortiert.length; index += 1) {
    if (sortiert[index] === sortiert[index - 1] + 1) {
      laenge += 1;
    } else {
      start = sortiert[index];
      laenge = 1;
    }
    if (laenge > beste.laenge) beste = { laenge, von: start, bis: sortiert[index] };
  }
  void letzterSpieltag;
  return beste;
}

export function buildLeagueRecordBook(gameState: GameState, ledgerInput?: SeasonPointsLedger): LeagueRecordBook {
  const ledger = ledgerInput ?? buildSeasonPointsLedger(gameState);

  const spieltagVonResult = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === gameState.season.id)
      .map((result) => [result.id, result.matchdayId] as const),
  );
  const eigeneDisziplinen = (gameState.seasonState.disciplineResults ?? []).filter((result) =>
    spieltagVonResult.has(result.matchdayResultId),
  );

  const spielerNamen = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));
  const teams = new Map((gameState.teams ?? []).map((team) => [team.teamId, team] as const));
  const disziplinNamen = new Map((gameState.disciplines ?? []).map((d) => [d.id, d.name] as const));

  const spieltagNamen = new Map(
    [...spieltagVonResult.values()].map((matchdayId) => [matchdayId, `Spieltag ${spieltagNummer(matchdayId)}`] as const),
  );
  const matchdaysPlayed = new Set(spieltagVonResult.values()).size;
  const letzterSpieltag = Math.max(0, ...[...spieltagVonResult.values()].map(spieltagNummer));

  const spieltagsSuperlative: RecordBookEntry[] = [];
  const serien: RecordBookEntry[] = [];

  // --- Bester Einzelauftritt --------------------------------------------
  let besterAuftritt: (typeof ledger.pointEntries)[number] | null = null;
  for (const entry of ledger.pointEntries) {
    if (!Number.isFinite(entry.finalPlayerScore)) continue;
    if (besterAuftritt == null || entry.finalPlayerScore > besterAuftritt.finalPlayerScore) {
      besterAuftritt = entry;
    }
  }
  if (besterAuftritt) {
    const team = teams.get(besterAuftritt.teamId) ?? null;
    spieltagsSuperlative.push({
      id: "best-single-performance",
      label: "Bester Einzelauftritt",
      beschreibung: "Die höchste Wertung, die ein Spieler je in einer Disziplin erzielt hat.",
      displayValue: formatZahl(besterAuftritt.finalPlayerScore, 1),
      halter: spielerNamen.get(besterAuftritt.playerId) ?? besterAuftritt.playerId,
      kontext: [
        disziplinNamen.get(besterAuftritt.disciplineId) ?? besterAuftritt.disciplineId,
        besterAuftritt.matchdayId ? spieltagNamen.get(besterAuftritt.matchdayId) ?? null : null,
        team?.shortCode ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      playerId: besterAuftritt.playerId,
      teamId: besterAuftritt.teamId,
      laeuftNoch: false,
    });
  }

  // --- Bester Spieltag eines Spielers ------------------------------------
  const punkteJeSpielerUndSpieltag = new Map<string, { playerId: string; matchdayId: string; punkte: number }>();
  for (const entry of ledger.pointEntries) {
    const matchdayId = entry.matchdayId ?? spieltagVonResult.get(entry.matchdayResultId) ?? null;
    if (!matchdayId) continue;
    const schluessel = `${entry.playerId}::${matchdayId}`;
    const bisher = punkteJeSpielerUndSpieltag.get(schluessel) ?? { playerId: entry.playerId, matchdayId, punkte: 0 };
    bisher.punkte = runde(bisher.punkte + entry.points, 2);
    punkteJeSpielerUndSpieltag.set(schluessel, bisher);
  }
  const besterSpielerSpieltag = [...punkteJeSpielerUndSpieltag.values()].sort((links, rechts) => rechts.punkte - links.punkte)[0] ?? null;
  if (besterSpielerSpieltag && besterSpielerSpieltag.punkte > 0) {
    spieltagsSuperlative.push({
      id: "best-player-matchday",
      label: "Bester Spieltag eines Spielers",
      beschreibung: "Die meisten Punkte, die ein Spieler an einem einzigen Spieltag gesammelt hat.",
      displayValue: `${formatZahl(besterSpielerSpieltag.punkte, 1)} PPs`,
      halter: spielerNamen.get(besterSpielerSpieltag.playerId) ?? besterSpielerSpieltag.playerId,
      kontext: spieltagNamen.get(besterSpielerSpieltag.matchdayId) ?? null,
      playerId: besterSpielerSpieltag.playerId,
      teamId: null,
      laeuftNoch: false,
    });
  }

  // --- Bestes Team-Ergebnis in einer Disziplin ---------------------------
  const bestesTeamErgebnis = [...eigeneDisziplinen]
    .filter((result) => Number.isFinite(result.totalScore))
    .sort((links, rechts) => (rechts.totalScore ?? 0) - (links.totalScore ?? 0))[0] ?? null;
  if (bestesTeamErgebnis) {
    const team = teams.get(bestesTeamErgebnis.teamId) ?? null;
    const matchdayId = spieltagVonResult.get(bestesTeamErgebnis.matchdayResultId) ?? null;
    spieltagsSuperlative.push({
      id: "best-team-discipline",
      label: "Bestes Team-Ergebnis",
      beschreibung: "Die höchste Punktzahl, die ein Team in einer Disziplin erreicht hat.",
      displayValue: formatZahl(bestesTeamErgebnis.totalScore ?? 0, 1),
      halter: team?.name ?? bestesTeamErgebnis.teamId,
      kontext: [
        disziplinNamen.get(bestesTeamErgebnis.disciplineId) ?? bestesTeamErgebnis.disciplineId,
        matchdayId ? spieltagNamen.get(matchdayId) ?? null : null,
      ]
        .filter(Boolean)
        .join(" · "),
      playerId: null,
      teamId: bestesTeamErgebnis.teamId,
      laeuftNoch: false,
    });
  }

  /**
   * Knappster Disziplinsieg — der Abstand zwischen Rang 1 und Rang 2 derselben Disziplin
   * desselben Spieltags.
   *
   * Gruppiert wird über (Spieltag, Disziplin, Seite): das ist ein Wettbewerb. Ohne die Seite
   * lägen zwei getrennte Wettbewerbe in einem Topf und der „Abstand" wäre erfunden.
   */
  const wettbewerbe = new Map<string, Array<{ teamId: string; totalScore: number; rank: number }>>();
  for (const result of eigeneDisziplinen) {
    if (!Number.isFinite(result.totalScore)) continue;
    const matchdayId = spieltagVonResult.get(result.matchdayResultId) ?? "";
    const schluessel = `${matchdayId}::${result.disciplineId}::${result.disciplineSide}`;
    const gruppe = wettbewerbe.get(schluessel) ?? [];
    gruppe.push({ teamId: result.teamId, totalScore: result.totalScore ?? 0, rank: result.rank ?? Number.POSITIVE_INFINITY });
    wettbewerbe.set(schluessel, gruppe);
  }
  let knappster: { abstand: number; sieger: string; verfolger: string; kontext: string; teamId: string } | null = null;
  for (const [schluessel, gruppe] of wettbewerbe.entries()) {
    if (gruppe.length < 2) continue;
    const sortiert = [...gruppe].sort((links, rechts) => rechts.totalScore - links.totalScore);
    const abstand = runde(sortiert[0].totalScore - sortiert[1].totalScore, 2);
    if (abstand < 0) continue;
    if (knappster != null && abstand >= knappster.abstand) continue;
    const [matchdayId, disciplineId] = schluessel.split("::");
    knappster = {
      abstand,
      sieger: teams.get(sortiert[0].teamId)?.name ?? sortiert[0].teamId,
      verfolger: teams.get(sortiert[1].teamId)?.shortCode ?? sortiert[1].teamId,
      kontext: [disziplinNamen.get(disciplineId) ?? disciplineId, spieltagNamen.get(matchdayId) ?? null]
        .filter(Boolean)
        .join(" · "),
      teamId: sortiert[0].teamId,
    };
  }
  if (knappster) {
    spieltagsSuperlative.push({
      id: "closest-discipline-win",
      label: "Knappster Disziplinsieg",
      beschreibung: "Der kleinste Abstand zwischen Sieger und Zweitem in einer Disziplin.",
      displayValue: formatZahl(knappster.abstand, 2),
      halter: knappster.sieger,
      kontext: `${knappster.kontext} · vor ${knappster.verfolger}`,
      playerId: null,
      teamId: knappster.teamId,
      laeuftNoch: false,
    });
  }

  // --- Höchster Form-Schub -----------------------------------------------
  // Das Zuhause des Team-Formwerts: `formModifier` gibt es NUR je Team und Disziplin, deshalb
  // steht er hier und nicht bei den Spieler-Awards.
  const besterFormSchub = [...eigeneDisziplinen]
    .filter((result) => Number.isFinite(result.formModifier) && (result.formModifier ?? 0) > 0)
    .sort((links, rechts) => (rechts.formModifier ?? 0) - (links.formModifier ?? 0))[0] ?? null;
  if (besterFormSchub) {
    const matchdayId = spieltagVonResult.get(besterFormSchub.matchdayResultId) ?? null;
    spieltagsSuperlative.push({
      id: "best-form-boost",
      label: "Höchster Form-Schub",
      beschreibung: "Der größte Formbonus, den ein Team in einer Disziplin mitgenommen hat.",
      displayValue: `+${formatZahl(besterFormSchub.formModifier ?? 0, 1)}`,
      halter: teams.get(besterFormSchub.teamId)?.name ?? besterFormSchub.teamId,
      kontext: [
        disziplinNamen.get(besterFormSchub.disciplineId) ?? besterFormSchub.disciplineId,
        matchdayId ? spieltagNamen.get(matchdayId) ?? null : null,
      ]
        .filter(Boolean)
        .join(" · "),
      playerId: null,
      teamId: besterFormSchub.teamId,
      laeuftNoch: false,
    });
  }

  // --- Längste Team-Siegesserie ------------------------------------------
  const siegSpieltageJeTeam = new Map<string, number[]>();
  for (const result of eigeneDisziplinen) {
    if (result.rank !== 1) continue;
    const matchdayId = spieltagVonResult.get(result.matchdayResultId) ?? "";
    const bisher = siegSpieltageJeTeam.get(result.teamId) ?? [];
    bisher.push(spieltagNummer(matchdayId));
    siegSpieltageJeTeam.set(result.teamId, bisher);
  }
  let besteTeamSerie: { teamId: string; laenge: number; von: number; bis: number } | null = null;
  for (const [teamId, spieltage] of siegSpieltageJeTeam.entries()) {
    const serie = serieAus(spieltage, letzterSpieltag);
    if (!serie) continue;
    if (besteTeamSerie == null || serie.laenge > besteTeamSerie.laenge) {
      besteTeamSerie = { teamId, ...serie };
    }
  }
  if (besteTeamSerie) {
    const laeuftNoch = besteTeamSerie.bis === letzterSpieltag;
    serien.push({
      id: "longest-team-win-streak",
      label: "Längste Siegesserie",
      beschreibung: "Die meisten aufeinanderfolgenden Spieltage, an denen ein Team eine Disziplin gewann.",
      displayValue: `${besteTeamSerie.laenge} Spieltage`,
      halter: teams.get(besteTeamSerie.teamId)?.name ?? besteTeamSerie.teamId,
      kontext: laeuftNoch
        ? `läuft — seit Spieltag ${besteTeamSerie.von}`
        : `Spieltag ${besteTeamSerie.von}–${besteTeamSerie.bis}`,
      playerId: null,
      teamId: besteTeamSerie.teamId,
      laeuftNoch,
    });
  }

  // --- Längste Top-10-Serie eines Spielers -------------------------------
  const top10SpieltageJeSpieler = new Map<string, number[]>();
  for (const entry of ledger.pointEntries) {
    if (!entry.isTop10) continue;
    const matchdayId = entry.matchdayId ?? spieltagVonResult.get(entry.matchdayResultId) ?? "";
    const bisher = top10SpieltageJeSpieler.get(entry.playerId) ?? [];
    bisher.push(spieltagNummer(matchdayId));
    top10SpieltageJeSpieler.set(entry.playerId, bisher);
  }
  let besteSpielerSerie: { playerId: string; laenge: number; von: number; bis: number } | null = null;
  for (const [playerId, spieltage] of top10SpieltageJeSpieler.entries()) {
    const serie = serieAus(spieltage, letzterSpieltag);
    if (!serie) continue;
    if (besteSpielerSerie == null || serie.laenge > besteSpielerSerie.laenge) {
      besteSpielerSerie = { playerId, ...serie };
    }
  }
  if (besteSpielerSerie) {
    const laeuftNoch = besteSpielerSerie.bis === letzterSpieltag;
    serien.push({
      id: "longest-player-top10-streak",
      label: "Längste Top-10-Serie",
      beschreibung: "Die meisten aufeinanderfolgenden Spieltage mit einem Top-10-Auftritt.",
      displayValue: `${besteSpielerSerie.laenge} Spieltage`,
      halter: spielerNamen.get(besteSpielerSerie.playerId) ?? besteSpielerSerie.playerId,
      kontext: laeuftNoch
        ? `läuft — seit Spieltag ${besteSpielerSerie.von}`
        : `Spieltag ${besteSpielerSerie.von}–${besteSpielerSerie.bis}`,
      playerId: besteSpielerSerie.playerId,
      teamId: null,
      laeuftNoch,
    });
  }

  return { spieltagsSuperlative, serien, matchdaysPlayed };
}
