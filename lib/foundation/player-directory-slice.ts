import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature, getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { hydrateSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import {
  buildExpectedSellValueByPlayerId,
  type ExpectedSellValueEntry,
} from "@/lib/market/transfermarkt-expected-sell-value";
import { ratingsSliceRowsFromPersisted } from "@/lib/foundation/resolve-slice-save-context";
import {
  buildSeasonRatingsSlice,
  maskRatingsRowForVisibility,
  type SeasonRatingsSlicePlayerRow,
} from "@/lib/foundation/season-ratings-slice";
import { buildPlayerAttributeVisibilityResolver } from "@/lib/foundation/server-player-visibility";
import { buildMarktwertHerleitung, type MarktwertHerleitung } from "@/lib/foundation/marktwert-herleitung";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { buildMarketValueDisciplineInputsFromPlayers } from "@/lib/player-formulas/league-market-value-snapshot";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";

export type PlayerDirectoryPerformanceRow = Pick<
  PlayerSeasonPerformanceSummary,
  | "appearances"
  | "totalPoints"
  | "bestDisciplineLabel"
  | "bestDisciplineScore"
  | "latestMatchdayId"
  | "latestFinalScore"
>;

export type PlayerDirectorySliceResponse = {
  scope: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
  };
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
  performanceByPlayerId: Record<string, PlayerDirectoryPerformanceRow>;
  careerStatsByPlayerId: Record<
    string,
    {
      appearances: number;
      totalPps: number;
      seasonsPlayed: number;
    }
  >;
  /**
   * In der laufenden Saison je Disziplin geholte PPs (Disziplin-ID → PPs) aus
   * dem Saison-Ledger — die aufklappbaren Achsen-Spalten der Spielerliste.
   *
   * Warum ueberhaupt im Slice und nicht clientseitig aus dem Ledger? Der
   * Foundation-Client haelt per Default den KOMPAKTEN Payload
   * (`compactFoundationInitialGameState`): dort sind `matchdayResults` /
   * `disciplineResults` auf den AKTIVEN Spieltag beschnitten und
   * `persistedSeasonDerivations` entfernt. Ein clientseitig gebauter
   * `buildSeasonPointsLedger` kennt damit nur den aktiven Spieltag — und ist,
   * solange dieser noch nicht ausgewertet ist, komplett leer. Genau dieselben
   * Werte, die hier als `ppsSeason`/`ppPow`… aus dem SERVER-Ledger kommen,
   * muessen deshalb auch pro Disziplin von hier kommen, sonst stehen in den
   * aufgeklappten Spalten Nullen neben einer gefuellten PPS-Spalte.
   *
   * Bewusst DUENN besetzt: nur Disziplinen mit Punkten stehen drin. Fehlt ein
   * Eintrag, sind es 0 PPs — dieselbe Lesart wie in
   * `buildRosterDisciplinePpsByAxis`. Ein Spieler ohne Punkte fehlt ganz.
   */
  disciplinePointsByPlayerId: Record<string, Record<string, number>>;
  /**
   * Erwarteter Verkaufswert je Kaderspieler ("VK-Wert"-Spalte der Spielerliste),
   * gerechnet auf dem VOLLSTAENDIGEN Save.
   *
   * GEMELDET: „warum haben die spieler keinen +/- im verkaufswert obwohl 17
   * spieler in dem bracket sind?" — und kurz darauf „scheint nun ueberall
   * kaputt zu sein egal welches bracket".
   *
   * Es war nicht der Verkaufsfaktor, sondern die Datenlage des Clients. Der
   * Verkaufspreis ist Marktwert x Verkaufsfaktor, und der Faktor haengt am Rang
   * des Spielers in seiner Preisklasse. Ob dieses Ranking ueberhaupt gilt,
   * entscheidet `hasCurrentSeasonSaleFactorRanking` an den gewerteten
   * `matchdayResults` der laufenden Saison — die im kompakten Client-Payload
   * (`compactFoundationInitialGameState`) auf den AKTIVEN Spieltag beschnitten
   * sind. Ein noch nicht ausgewerteter aktiver Spieltag heisst dort: gar kein
   * gewertetes Ergebnis, also kein Ranking, also Faktor 1,0 fuer JEDEN Spieler
   * — und damit VK-Wert == Marktwert in jeder Zeile, in jedem Bracket.
   *
   * Am gemeldeten Spielstand (Saison 1, Spieltag 7) nachgemessen: auf dem
   * vollen Save weichen 328 von 339 Kaderspielern vom Marktwert ab, auf dem
   * kompakten Payload 0 von 339. Amystheta (Bracket 7, Rang 1 von 17): 65,84
   * Mio auf dem Server, 47,03 Mio (= exakt ihr Marktwert) im Browser.
   *
   * Deshalb kommt der Wert von hier — dieselbe Begruendung und derselbe Weg wie
   * bei `disciplinePointsByPlayerId` einen Absatz weiter oben. Die fehlenden
   * `matchdayResults` im Payload nachzuliefern loest es NICHT: der Client
   * rechnet dann zwar wieder mit Ranking, aber ohne die Server-Derivations mit
   * anderen MVS — gemessen 292 von 339 Zeilen abweichend vom Server. Eine
   * zweite, leicht andere Zahl ist schlechter als eine offensichtlich gleiche.
   *
   * Nur Kaderspieler stehen drin: Free Agents koennen nicht verkauft werden,
   * fuer sie ist "—" die ehrliche Antwort (siehe
   * `buildExpectedSellValueByPlayerId`).
   */
  sellValueByPlayerId: Record<string, ExpectedSellValueEntry>;
  /**
   * Zerlegung des Marktwerts je Kaderspieler — der Hover auf der MW-Spalte (Chris' Punkt 6).
   *
   * Warum vom Server und nicht im Browser gerechnet: die Zerlegung braucht den ligaweiten Rang des
   * Spielers in JEDER Disziplin und die Tabelle `rank-to-discipline-market-value.json`. Die ist
   * 222 KB gross und liegt heute in keinem Client-Bundle; sie fuer einen Hover hineinzuziehen
   * waere ein schlechter Tausch. Eine gekuerzte Tabelle waere schlimmer — sie ergaebe eine ZWEITE,
   * leicht andere Zahl neben der gezeigten, und genau das ist eine Zeile weiter oben schon einmal
   * als schlechtere Loesung verworfen worden.
   *
   * NUR KADERSPIELER, aus Groessengruenden am Live-Abbild nachgemessen: ueber alle 2984 Spieler
   * waeren es 1163 KB, ueber die 328 Kaderspieler 128 KB — dieselbe Groessenordnung wie
   * `sellValueByPlayerId` daneben. Fuer einen vereinslosen Spieler faellt der Hover weg.
   */
  marketValueBreakdownByPlayerId: Record<string, MarktwertHerleitung>;
  count: number;
};

/** Nur Disziplinen mit tatsaechlichen Punkten — 0/NaN fliegen raus (siehe Feldkommentar). */
function toDisciplinePointsRow(pointsByDiscipline: Record<string, number>): Record<string, number> {
  const row: Record<string, number> = {};
  for (const [disciplineId, points] of Object.entries(pointsByDiscipline)) {
    if (typeof points === "number" && Number.isFinite(points) && points !== 0) {
      row[disciplineId] = points;
    }
  }
  return row;
}

/**
 * Disziplin-PPs aller Spieler aus den Ledger-Summaries. Spieler ohne Punkte
 * tauchen nicht auf (statt mit einem leeren Objekt) — das haelt den Payload
 * klein und aendert die Bedeutung nicht.
 */
function buildDisciplinePointsByPlayerId(
  playerSummariesByPlayerId: Map<string, { pointsByDiscipline: Record<string, number> }>,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [playerId, summary] of playerSummariesByPlayerId) {
    const row = toDisciplinePointsRow(summary.pointsByDiscipline ?? {});
    if (Object.keys(row).length > 0) {
      result[playerId] = row;
    }
  }
  return result;
}

/**
 * Zerlegt den Marktwert jedes KADERSPIELERS in seine Rangbeitraege (siehe Feldkommentar oben).
 *
 * Die Engine rankt ohnehin die ganze Liga — anders ginge es auch nicht, der Rang IST der ligaweite.
 * Weggeworfen wird erst danach: gespeichert werden nur die Zeilen der Spieler, die im Kader stehen.
 */
function buildMarketValueBreakdownByPlayerId(gameState: GameState): Record<string, MarktwertHerleitung> {
  const ergebnis = calculateMarketValueFromRankTable({
    players: buildMarketValueDisciplineInputsFromPlayers(gameState.players),
    rankToDisciplineMarketValue: loadPlayerFormulaSources().rankToDisciplineMarketValue,
  });
  // Fehlt die Rangtabelle, gibt es keine Zerlegung — und dann bleibt der Hover leer, statt eine
  // Herleitung zu erfinden. Dieselbe Regel wie bei den Saisonstand-Hovers.
  if (ergebnis.status !== "ready") {
    return {};
  }
  const imKader = new Set(gameState.rosters.map((eintrag) => eintrag.playerId));
  const zeilen: Record<string, MarktwertHerleitung> = {};
  for (const fixture of ergebnis.players) {
    if (!imKader.has(fixture.playerId)) continue;
    const herleitung = buildMarktwertHerleitung(fixture);
    if (herleitung) {
      zeilen[fixture.playerId] = herleitung;
    }
  }
  return zeilen;
}

function toPerformanceRow(summary: PlayerSeasonPerformanceSummary): PlayerDirectoryPerformanceRow {
  return {
    appearances: summary.appearances,
    totalPoints: summary.totalPoints,
    bestDisciplineLabel: summary.bestDisciplineLabel,
    bestDisciplineScore: summary.bestDisciplineScore,
    latestMatchdayId: summary.latestMatchdayId,
    latestFinalScore: summary.latestFinalScore,
  };
}

type PlayerDirectoryCareerStatsRow = PlayerDirectorySliceResponse["careerStatsByPlayerId"][string];

/** Fog-of-War-Maskierung (T-022): exakte Season-Performance eines nicht
 * gescouteten/fremden Spielers nullen — analog zu `maskAxisCardsForVisibility`
 * im Player-Detail-Drawer, das seasonPoints/allTimePoints bei `"scouted"`
 * ebenfalls entfernt. */
function maskPerformanceRow(): PlayerDirectoryPerformanceRow {
  return {
    appearances: 0,
    totalPoints: null,
    bestDisciplineLabel: null,
    bestDisciplineScore: null,
    latestMatchdayId: null,
    latestFinalScore: null,
  };
}

function maskCareerStatsRow(): PlayerDirectoryCareerStatsRow {
  return {
    appearances: 0,
    totalPps: 0,
    seasonsPlayed: 0,
  };
}

/**
 * Maskiert eine bereits gebaute Player-Directory-Slice-Antwort anhand des
 * anfragenden Teams (T-022). Läuft unabhängig davon, ob der Payload aus dem
 * Live-GameState- oder dem persisted-Projektions-Pfad stammt — beide liefern
 * denselben `PlayerDirectorySliceResponse`-Shape, und der Aufrufer hat in
 * beiden Fällen bereits einen `GameState` mit Roster-/Team-/Scouting-Kontext
 * zur Hand (siehe `resolveSliceSave`, das auch im projectionOnly-Zweig einen
 * materialisierten Slice-GameState zurückgibt).
 */
export function maskPlayerDirectorySliceForRequestingTeam(input: {
  payload: PlayerDirectorySliceResponse;
  gameState: GameState;
  requestingTeamId?: string | null;
}): PlayerDirectorySliceResponse {
  const resolveVisibility = buildPlayerAttributeVisibilityResolver({
    gameState: input.gameState,
    requestingTeamId: input.requestingTeamId,
  });

  const ratingsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.ratingsByPlayerId).map(([playerId, row]) => [
      playerId,
      maskRatingsRowForVisibility(row, resolveVisibility(playerId)),
    ]),
  );
  const performanceByPlayerId = Object.fromEntries(
    Object.entries(input.payload.performanceByPlayerId).map(([playerId, row]) => [
      playerId,
      resolveVisibility(playerId) === "exact" ? row : maskPerformanceRow(),
    ]),
  );
  const careerStatsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.careerStatsByPlayerId).map(([playerId, row]) => [
      playerId,
      resolveVisibility(playerId) === "exact" ? row : maskCareerStatsRow(),
    ]),
  );
  // Disziplin-PPs sind exakte Saison-Leistung — dieselbe Fog-Regel wie
  // `performanceByPlayerId`/`ppsSeason`: nicht sichtbar ⇒ Eintrag faellt weg
  // (die Zelle zeigt dann "—", statt eine Zahl zu verraten).
  const disciplinePointsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.disciplinePointsByPlayerId).filter(
      ([playerId]) => resolveVisibility(playerId) === "exact",
    ),
  );
  // Der Verkaufswert traegt den Bracket-Rang aus MVS/PPs in sich — also exakte
  // Saison-Leistung, nur anders verpackt. Dieselbe Fog-Regel wie eine Zeile
  // hoeher: nicht sichtbar ⇒ Eintrag faellt weg.
  const sellValueByPlayerId = Object.fromEntries(
    Object.entries(input.payload.sellValueByPlayerId ?? {}).filter(
      ([playerId]) => resolveVisibility(playerId) === "exact",
    ),
  );
  // Die MW-Zerlegung nennt je Disziplin den ligaweiten RANG — das ist die Disziplinstaerke des
  // Spielers, nur anders ausgedrueckt, und die ist fog-gated (`maskRatingsRowForVisibility`). Der
  // Marktwert selbst bleibt sichtbar; erklaert wird er nur dort, wo man die Werte ohnehin sehen
  // duerfte. Sonst waere der Hover ein Scouting-Bericht zum Nulltarif.
  const marketValueBreakdownByPlayerId = Object.fromEntries(
    Object.entries(input.payload.marketValueBreakdownByPlayerId ?? {}).filter(
      ([playerId]) => resolveVisibility(playerId) === "exact",
    ),
  );

  return {
    ...input.payload,
    ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId,
    sellValueByPlayerId,
    marketValueBreakdownByPlayerId,
  };
}

export function buildPlayerDirectorySliceFromPersisted(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  persistedRecord: PersistedSeasonDerivationsRecord;
  seasonState: SeasonState;
}): PlayerDirectorySliceResponse {
  const derivations = hydrateSeasonDerivations(input.persistedRecord);
  const ratingsByPlayerId = ratingsSliceRowsFromPersisted(input.persistedRecord);
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(
      {
        season: { id: input.seasonId },
        seasonState: input.seasonState,
      } as GameState,
      {
        currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
        currentSeasonLedger: derivations.ledger,
      },
    ),
  );
  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
    },
    ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId: buildDisciplinePointsByPlayerId(derivations.ledger.playerSummariesByPlayerId),
    // Der Projektions-Pfad hat nur Derivations + SeasonState, keinen GameState mit
    // Rostern/Vertraegen — ohne die gibt es keinen Verkaufswert. Leer statt geraten:
    // der Client faellt dann auf seine eigene Rechnung zurueck (siehe Feldkommentar).
    sellValueByPlayerId: {},
    // Dieselbe Lage: die Zerlegung braucht `players` mit ihren Disziplinwerten (fuer die
    // ligaweiten Raenge) und `rosters` (fuer den Zuschnitt). Der Projektions-Pfad hat beides
    // nicht. Leer heisst hier: kein Hover — nicht „Marktwert ohne Bestandteile".
    marketValueBreakdownByPlayerId: {},
    count: Object.keys(ratingsByPlayerId).length,
  };
}

export function buildPlayerDirectorySlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}): PlayerDirectorySliceResponse {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const derivations = getSeasonDerivations({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const ratingsSlice = buildSeasonRatingsSlice({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(input.gameState, {
      currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
      currentSeasonLedger: derivations.ledger,
    }),
  );

  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId,
      contentSignature,
    },
    ratingsByPlayerId: ratingsSlice.ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId: buildDisciplinePointsByPlayerId(derivations.ledger.playerSummariesByPlayerId),
    // Mit `saveId`, damit der Sale-Factor dieselben Season-Derivations (MVS/PPs) sieht
    // wie der Rest dieses Slices — sonst rankt die Preisklasse gegen andere Zahlen.
    sellValueByPlayerId: Object.fromEntries(
      buildExpectedSellValueByPlayerId(input.gameState, { saveId: input.saveId }),
    ),
    marketValueBreakdownByPlayerId: buildMarketValueBreakdownByPlayerId(input.gameState),
    count: Object.keys(ratingsSlice.ratingsByPlayerId).length,
  };
}
