/**
 * DIE TOPSPIELER DES GANZEN SPIELTAGS — EINE SUMMIERUNG, ZWEI QUELLEN.
 *
 * GEMELDET VON CHRIS: „die top players in der arena ganz unten zeigen immer noch 1 diszi und nicht
 * beide! dort sollen alle aus beiden diszis drin sein damit man den besten des spieltags sehen
 * kann!"
 *
 * WAS NACHGEMESSEN FALSCH WAR — und was NICHT:
 *
 * Der Verdacht im Plan lautete: `readMatchdayResolveSnapshot` liefert seit `697e2a4d` `null`,
 * sobald beide Seiten gebucht sind, damit fehle der Arena die Vorschau, und die Liste falle auf
 * die EINE laufende Disziplin zurueck. GEMESSEN am Live-Abbild (Save
 * `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10, beide Seiten gebucht): der Verdacht
 * stimmt NICHT. `loadMatchdayArenaBase` faellt ohne Snapshot auf
 * `loadSqliteLegacyMatchdayResolvePreview` zurueck und liefert weiterhin eine Vorschau mit BEIDEN
 * Disziplinen (spurt: 127 Spielerzeilen, i-spy: 159).
 *
 * Der echte Befund steckt in den ZAHLEN dieser Rueckfall-Vorschau. Sie wird auf dem Stand NACH der
 * Buchung frisch gerechnet (Fatigue und Verletzungen des Spieltags sind da schon angewandt) und
 * hat mit dem, was im Saisonstand steht, nichts mehr zu tun. Am selben Spieltag gemessen:
 *
 *   285 von 286 Spieler-Scores weichen vom Gebuchten ab (max 41,8)
 *   227 von 286 Player-Points weichen ab (max 1,4568 PP)
 *   4 von 12 Namen der Top-12 sind andere — Bunnyblade, Verla Compliance und Shadowsong fehlen,
 *   Ruby Ashen, Dragonfly und Lysira stehen faelschlich da; und schon Platz 2 kippt
 *   (gebucht Umbra 3,9453 PP, angezeigt Kryntheron 4,1174 PP).
 *
 * Wer „den besten des spieltags" sucht, bekam also eine Liste, die es nie gegeben hat. Die Buehne
 * darueber zeigte zur selben Zeit die GEBUCHTEN Bahnen — `chooseDisciplineStageTeams` sorgt dafuer
 * seit dem Snapshot-Befund. Nur die Spielerliste darunter blieb bei der Vorschau.
 *
 * DESHALB DIESE DATEI: eine einzige Summierung (`summiereSpieltagsTopSpieler`), gefuettert aus
 * zwei Quellen, die BEIDE dieselbe Zeilenform liefern:
 *   - `spieltagsTopSpielerAusVorschau` — die laufende, noch nicht gebuchte Disziplin.
 *   - `spieltagsTopSpielerAusBuchung`  — die gewertete Disziplin, Punkte aus dem Saison-Ledger
 *     (`buildSeasonPointsLedger`), also genau die Zahl, die im Spielstand steht.
 * `waehleSpieltagsTopSpielerZeilen` entscheidet je Disziplin: ist sie gebucht, gewinnt das
 * Gebuchte. Dieselbe Lehre wie bei `chooseDisciplineStageTeams` — lieber die karge Wahrheit als
 * eine huebschere Zahl, die nie im Saisonstand stand.
 *
 * KEINE ZWEITE RECHENSTELLE: gerechnet wird nur an EINER Stelle, in
 * `summiereSpieltagsTopSpieler`. Die beiden Quellfunktionen lesen bloss ab. Und die Punkte kommen
 * nicht aus einer nachgebauten Verteilung, sondern aus dem Ledger, der sie auch bucht.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";
import {
  buildSeasonPointsLedger,
  type SeasonPointsLedger,
} from "@/lib/foundation/season-points-ledger";
import type { DisciplineResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * EINE Spielerzeile EINER Disziplin — die gemeinsame Form beider Quellen.
 *
 * Bewusst `pointsAwarded` + `mutatorPpsBonus` getrennt statt einer fertigen PP-Zahl: die
 * Zusammenlegung macht `resolveAwardedPlayerPoints`, und die soll fuer beide Quellen dieselbe
 * sein. Eine Quelle, die ihre PP schon addiert mitbraechte, waere die zweite Rechenstelle.
 */
export type SpieltagsTopSpielerZeile = {
  playerId: string;
  playerName: string;
  teamId: string;
  disciplineId: string;
  finalPlayerScore: number;
  pointsAwarded: number | null;
  mutatorPpsBonus: number | null;
  isMvpCandidate: boolean;
};

/** Ein Spieler, ueber alle aufgedeckten Disziplinen des Spieltags zusammengezaehlt. */
export type SpieltagsTopSpieler = {
  playerId: string;
  playerName: string;
  teamId: string;
  /** Summe der Scores beider Disziplinen. */
  score: number;
  /** Summe der gutgeschriebenen Player-Points (Anteil + Mutator), `null` wenn keine Seite eine kennt. */
  points: number | null;
  /** Darin enthaltener Mutator-Aufschlag. */
  mutatorPoints: number | null;
  isMvp: boolean;
  /** Aus welchen Disziplinen der Spieler hier steht — in der Reihenfolge des Auftretens. */
  disciplineIds: string[];
};

/** Wie viele Zeilen die Liste unter der Spieltags-Wertung traegt. */
export const SPIELTAGS_TOPSPIELER_LIMIT = 12;

/**
 * DIE EINE RECHENSTELLE.
 *
 * Summiert je Spieler ueber die AUFGEDECKTEN Disziplinen: ein Spieler, der in beiden antrat, steht
 * genau EINMAL da, mit der Summe seiner Punkte und Scores. Nicht aufgedeckte Disziplinen fallen
 * heraus, bevor irgendetwas addiert wird — die Spoiler-Regel ist Teil der Rechnung, nicht ein
 * Filter davor oder danach.
 *
 * Gerundet wird auf 4 Stellen, wie im Saison-Ledger (`roundValue(..., 4)`). Auf eine Stelle zu
 * runden waere die Anzeige-Genauigkeit, nicht die Rechen-Genauigkeit: bei zwei Spielern, die sich
 * erst in der zweiten Stelle unterscheiden, kippte sonst die Sortierung.
 */
export function summiereSpieltagsTopSpieler(
  zeilen: readonly SpieltagsTopSpielerZeile[],
  aufgedeckteDisziplinIds: ReadonlySet<string>,
  limit: number = SPIELTAGS_TOPSPIELER_LIMIT,
): SpieltagsTopSpieler[] {
  const proSpieler = new Map<string, SpieltagsTopSpieler>();

  for (const zeile of zeilen) {
    if (!aufgedeckteDisziplinIds.has(zeile.disciplineId)) continue;
    // Ohne Spieler-Id liesse sich nicht sagen, ob zwei Zeilen derselbe Mensch sind — dann
    // stuende er womoeglich zweimal da. Solche Zeilen bleiben draussen, statt zu raten.
    if (!zeile.playerId) continue;

    const punkte = resolveAwardedPlayerPoints({
      pointsAwarded: zeile.pointsAwarded,
      mutatorPpsBonus: zeile.mutatorPpsBonus,
    });

    const vorhanden = proSpieler.get(zeile.playerId);
    if (!vorhanden) {
      proSpieler.set(zeile.playerId, {
        playerId: zeile.playerId,
        playerName: zeile.playerName,
        teamId: zeile.teamId,
        score: roundValue(zeile.finalPlayerScore, 4),
        points: punkte == null ? null : roundValue(punkte, 4),
        mutatorPoints: zeile.mutatorPpsBonus == null ? null : roundValue(zeile.mutatorPpsBonus, 4),
        isMvp: Boolean(zeile.isMvpCandidate),
        disciplineIds: [zeile.disciplineId],
      });
      continue;
    }

    vorhanden.score = roundValue(vorhanden.score + zeile.finalPlayerScore, 4);
    vorhanden.points =
      punkte == null && vorhanden.points == null ? null : roundValue((vorhanden.points ?? 0) + (punkte ?? 0), 4);
    vorhanden.mutatorPoints =
      zeile.mutatorPpsBonus == null && vorhanden.mutatorPoints == null
        ? null
        : roundValue((vorhanden.mutatorPoints ?? 0) + (zeile.mutatorPpsBonus ?? 0), 4);
    vorhanden.isMvp = vorhanden.isMvp || Boolean(zeile.isMvpCandidate);
    if (!vorhanden.disciplineIds.includes(zeile.disciplineId)) {
      vorhanden.disciplineIds.push(zeile.disciplineId);
    }
  }

  // Player-Points zuerst, Score als Tiebreak — die Reihenfolge, in der die Liste seit jeher liest
  // („sortiert nach den PPs … in Klammern dahinter ihr Score").
  return [...proSpieler.values()]
    .sort((links, rechts) => (rechts.points ?? -1) - (links.points ?? -1) || rechts.score - links.score)
    .slice(0, limit);
}

/** Zeilen aus der Resolve-Vorschau — die noch nicht gebuchte Disziplin. */
export function spieltagsTopSpielerAusVorschau(
  disciplinePreviews: readonly DisciplineResolvePreview[] | null | undefined,
): SpieltagsTopSpielerZeile[] {
  const zeilen: SpieltagsTopSpielerZeile[] = [];
  for (const dp of disciplinePreviews ?? []) {
    for (const eintrag of dp.topPlayers ?? []) {
      if (!eintrag.playerId) continue;
      zeilen.push({
        playerId: eintrag.playerId,
        playerName: eintrag.playerName,
        teamId: eintrag.teamId,
        disciplineId: dp.disciplineId,
        finalPlayerScore: eintrag.finalPlayerScore ?? 0,
        pointsAwarded: eintrag.pointsAwarded ?? null,
        mutatorPpsBonus: eintrag.mutatorPpsBonus ?? null,
        isMvpCandidate: Boolean(eintrag.isMvpCandidate),
      });
    }
  }
  return zeilen;
}

/**
 * Zeilen aus dem GEBUCHTEN Ergebnis — ohne jede Vorschau.
 *
 * Score und Mutator-Aufschlag stehen roh in `playerDisciplinePerformances`. Die Punkte NICHT: die
 * gebuchte Zeile traegt keinen `pointsAwarded` (nachgemessen: 0 von 2534 Zeilen im Live-Abbild).
 * Sie werden deshalb dort geholt, wo sie auch gebucht werden — im Saison-Ledger. Der leitet sie
 * aus Rang und Disziplin-Ergebnis ab; ihn hier nachzubauen waere genau die verbotene zweite
 * Rechenstelle.
 *
 * Der Ledger darf werfen (er tut es, wenn sich zu einer Leistungszeile keine Punkte ableiten
 * lassen). Dann gibt es hier eben keine gebuchten Zeilen und der Aufrufer bleibt bei der Vorschau
 * — eine karge Liste ist besser als ein weisser Bildschirm.
 */
export function spieltagsTopSpielerAusBuchung(input: {
  gameState: GameState;
  seasonId: string;
  matchdayId: string;
  /** Vorgebauter Ledger (der Aufrufer memoisiert ihn); sonst wird er hier gebaut. */
  ledger?: SeasonPointsLedger | null;
}): SpieltagsTopSpielerZeile[] {
  const { gameState, seasonId, matchdayId } = input;

  const ergebnisIds = new Set(
    (gameState.seasonState?.matchdayResults ?? [])
      .filter((eintrag) => eintrag.seasonId === seasonId && eintrag.matchdayId === matchdayId)
      .map((eintrag) => eintrag.id),
  );
  if (ergebnisIds.size === 0) return [];

  // Nur Disziplinen, zu denen auch ein Disziplin-Ergebnis gebucht ist. Leistungszeilen ohne
  // Disziplin-Ergebnis sind kein gewertetes Ergebnis — dieselbe Grenze zieht der Ledger.
  const gebuchteDisziplinIds = new Set(
    (gameState.seasonState?.disciplineResults ?? [])
      .filter((eintrag) => ergebnisIds.has(eintrag.matchdayResultId))
      .map((eintrag) => eintrag.disciplineId),
  );
  if (gebuchteDisziplinIds.size === 0) return [];

  let ledger: SeasonPointsLedger | null = input.ledger ?? null;
  if (!ledger) {
    try {
      ledger = buildSeasonPointsLedger(gameState, seasonId);
    } catch {
      return [];
    }
  }

  const punkteJeLeistungsId = ledger.pointEntriesByPerformanceId;
  const namensregister = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));

  const zeilen: SpieltagsTopSpielerZeile[] = [];
  for (const leistung of gameState.seasonState?.playerDisciplinePerformances ?? []) {
    if (!ergebnisIds.has(leistung.matchdayResultId)) continue;
    if (!gebuchteDisziplinIds.has(leistung.disciplineId)) continue;
    if (!leistung.playerId) continue;
    const gebucht = punkteJeLeistungsId.get(leistung.id) ?? null;
    zeilen.push({
      playerId: leistung.playerId,
      playerName: namensregister.get(leistung.playerId) ?? leistung.playerId,
      teamId: leistung.teamId,
      disciplineId: leistung.disciplineId,
      finalPlayerScore: leistung.finalPlayerScore ?? 0,
      // `basePoints` ist der Anteil OHNE Mutator — `resolveAwardedPlayerPoints` legt ihn in der
      // Summierung mit `mutatorPpsBonus` zusammen, genau wie der Ledger es beim Buchen tut.
      pointsAwarded: gebucht?.basePoints ?? null,
      mutatorPpsBonus: leistung.mutatorPpsBonus ?? null,
      isMvpCandidate: Boolean(leistung.isMvpCandidate),
    });
  }
  return zeilen;
}

export type SpieltagsTopSpielerQuelle = "booked" | "preview";

/**
 * WELCHE ZEILEN GELTEN — je Disziplin einzeln entschieden.
 *
 * Ist eine Disziplin gebucht, gewinnt das Gebuchte: es ist das, was im Saisonstand steht. Ist sie
 * es nicht (sie laeuft gerade), gilt die Vorschau. Ein Spieltag mit gebuchter D1 und laufender D2
 * mischt also bewusst — beide Haelften stehen mit der Zahl da, die fuer sie wahr ist, und
 * summiert werden sie trotzdem an derselben einen Stelle.
 */
export function waehleSpieltagsTopSpielerZeilen(input: {
  vorschauZeilen: readonly SpieltagsTopSpielerZeile[];
  buchungsZeilen: readonly SpieltagsTopSpielerZeile[];
}): { zeilen: SpieltagsTopSpielerZeile[]; quelleJeDisziplin: Map<string, SpieltagsTopSpielerQuelle> } {
  const gebuchteDisziplinIds = new Set(input.buchungsZeilen.map((zeile) => zeile.disciplineId));
  const quelleJeDisziplin = new Map<string, SpieltagsTopSpielerQuelle>();
  for (const id of gebuchteDisziplinIds) quelleJeDisziplin.set(id, "booked");

  const zeilen: SpieltagsTopSpielerZeile[] = [...input.buchungsZeilen];
  for (const zeile of input.vorschauZeilen) {
    if (gebuchteDisziplinIds.has(zeile.disciplineId)) continue;
    if (!quelleJeDisziplin.has(zeile.disciplineId)) quelleJeDisziplin.set(zeile.disciplineId, "preview");
    zeilen.push(zeile);
  }
  return { zeilen, quelleJeDisziplin };
}
